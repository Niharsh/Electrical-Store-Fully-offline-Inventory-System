// Database layer migrated from sqlite3 callbacks/promises to better-sqlite3
// All operations now use synchronous prepared statements and run in Electron main process only.
// Callers may still use async/await but the underlying calls are synchronous.

// Note: better-sqlite3 is a native module and must be properly included in the Electron build process.
// Make sure to install it with npm and configure electron-builder to include it in the final package.
// In development, it should work out of the box. In production, ensure that the asar packaging does not break the native module loading.
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let Database;
try {
  if (process.resourcesPath) {
    const unpackedPath = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'better-sqlite3'
    );
    if (fs.existsSync(unpackedPath)) {
      Database = require(unpackedPath);
      console.log('[db] Loaded better-sqlite3 from asar.unpacked:', unpackedPath);
    } else {
      Database = require('better-sqlite3');
      console.log('[db] Loaded better-sqlite3 from node_modules (fallback)');
    }
  } else {
    Database = require('better-sqlite3');
    console.log('[db] Loaded better-sqlite3 from node_modules (dev)');
  }
} catch (err) {
  console.error('[db] Failed to load better-sqlite3:', err.message);
  throw err;
}

let db = null;

// simple synchronous wrappers around better-sqlite3
function run(sql, params = []) {
  const stmt = db.prepare(sql);
  const info = stmt.run(...params);
  // mimic sqlite3 API for compatibility
  return { lastID: info.lastInsertRowid, changes: info.changes };
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

// Execute raw SQL (e.g. PRAGMA, BEGIN/COMMIT)
function exec(sql) {
  return db.exec(sql);
}

async function initializeDatabase() {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'medical_store.db');
  console.log('[database] Initializing better-sqlite3 at:', dbPath);

  try {
    db = new Database(dbPath);
  } catch (err) {
    console.error('[database] Failed to open database:', err);
    db = null;
    throw err;
  }

  // enable foreign key constraints
  db.pragma('foreign_keys = ON');
  console.log('[database] Foreign key constraints enabled');

  // Create tables sequentially
  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      product_type TEXT NOT NULL,
      hsn TEXT,
      generic_name TEXT,
      manufacturer TEXT,
      salt_composition TEXT,
      min_stock_level INTEGER DEFAULT 10,
      unit TEXT DEFAULT 'pc',
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Check if batches table exists with old schema
  const batchesCheck = await get(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='batches'"
  );

  if (!batchesCheck) {
    // Create batches table with composite UNIQUE constraint (product_id, batch_number)
    await run(`
      CREATE TABLE batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        batch_number TEXT NOT NULL,
        mrp REAL NOT NULL,
        selling_rate REAL NOT NULL,
        cost_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        expiry_date TEXT,
        wholesaler_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        UNIQUE(product_id, batch_number)
      )
    `);
  } else if (batchesCheck.sql.includes('batch_number TEXT NOT NULL UNIQUE')) {
    console.log('[database] Migrating batches table to fix UNIQUE constraint...');
    // Migrate old schema - drop & recreate
    try {
      await run('DROP TABLE IF EXISTS batches');
      await run(`
        CREATE TABLE batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          batch_number TEXT NOT NULL,
          mrp REAL NOT NULL,
          selling_rate REAL NOT NULL,
          cost_price REAL NOT NULL,
          quantity INTEGER NOT NULL,
          expiry_date TEXT,
          wholesaler_id INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id),
          UNIQUE(product_id, batch_number)
        )
      `);
      console.log('[database] Schema migration completed')    } catch (err) {
      console.warn('[database] Could not migrate schema:', err.message);
    }
  }

  await run(`
    CREATE TABLE IF NOT EXISTS wholesalers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      contactNumber TEXT,
      gstNumber TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS shop_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_name TEXT,
      owner_name TEXT,
      phone TEXT,
      address TEXT,
      gst_number TEXT,
      dl_number TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS product_types (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS hsn_codes (
      hsn_code TEXT PRIMARY KEY,
      description TEXT,
      gst_rate REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add product_name column to invoice_items if it doesn't exist
  try {
    await run('ALTER TABLE invoice_items ADD COLUMN product_name TEXT');
  } catch (err) {
    // Column likely already exists, ignore error
  }

  // Add expiry_date column to invoice_items if it doesn't exist
  try {
    await run('ALTER TABLE invoice_items ADD COLUMN expiry_date TEXT');
  } catch (err) {
    // Column likely already exists, ignore error
  }

  await run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      customer_dl_number TEXT,
      customer_address TEXT,
      notes TEXT,
      discount_percent REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      original_selling_rate REAL NOT NULL,
      selling_rate REAL NOT NULL,
      mrp REAL,
      hsn_code TEXT,
      discount_percent REAL DEFAULT 0,
      gst_percent REAL DEFAULT 0,
      is_return INTEGER DEFAULT 0,
      return_reason TEXT,
      subtotal REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS purchase_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT,
      purchase_date TEXT,
      wholesaler_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      amount_paid REAL DEFAULT 0,
      amount_due REAL,
      payment_status TEXT DEFAULT 'unpaid',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wholesaler_id) REFERENCES wholesalers(id)
    );
  `);

  // Owner account management (single-owner offline app)
  await run(`
    CREATE TABLE IF NOT EXISTS owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password_hash TEXT NOT NULL,
      recovery_code_hash TEXT,
      first_name TEXT,
      last_name TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('[database] Database initialized successfully (better-sqlite3)');
  return db;
}

async function getDatabase() {
  if (!db) await initializeDatabase();
  return db;
}

// Product functions
async function addProduct(productData) {
  await getDatabase();

  try {
    // Start transaction
    await exec('BEGIN TRANSACTION');
    
    const insertSql = `
      INSERT INTO products (
        name, product_type, hsn, generic_name, manufacturer, 
        salt_composition, min_stock_level, unit, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const res = await run(insertSql, [
      productData.name,
      productData.product_type,
      productData.hsn || null,
      productData.generic_name || null,
      productData.manufacturer || null,
      productData.salt_composition || null,
      productData.min_stock_level ?? 10,
      productData.unit || 'pc',
      productData.description || null,
    ]);

    const productId = res.lastID;
    console.log(`[db] addProduct: Created product ${productId}`);

    const savedBatches = [];
    if (productData.batches && Array.isArray(productData.batches)) {
      for (const batch of productData.batches) {
        try {
          const batchRes = await run(`
            INSERT INTO batches (
              product_id, batch_number, mrp, selling_rate, cost_price, 
              quantity, expiry_date, wholesaler_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            productId,
            batch.batch_number,
            batch.mrp,
            batch.selling_rate,
            batch.cost_price,
            batch.quantity,
            batch.expiry_date || null,
            batch.wholesaler_id || null,
          ]);

          savedBatches.push({ id: batchRes.lastID, ...batch });
        } catch (batchErr) {
          console.error(`[db] addProduct: Batch insert failed, rolling back:`, batchErr.message);
          throw batchErr; // Trigger rollback
        }
      }
    }

    // Fetch the complete product from database
    const product = await get('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) {
      throw new Error(`Failed to fetch product ${productId} after insert`);
    }

    // Fetch GST rate from HSN
    let gstRate = null;
    if (product.hsn) {
      const hsnData = await get('SELECT gst_rate FROM hsn_codes WHERE hsn_code = ?', [product.hsn]);
      if (hsnData) {
        gstRate = hsnData.gst_rate;
      }
    }

    // Commit transaction
    await exec('COMMIT');
    
    console.log(`[db] addProduct: SUCCESS - Product ${productId} with ${savedBatches.length} batches`);
    return { ...product, batches: savedBatches, gst_rate: gstRate };
    
  } catch (err) {
    console.error(`[db] addProduct: ERROR - Rolling back:`, err.message);
    try {
      await exec('ROLLBACK');
    } catch (rollbackErr) {
      console.error(`[db] addProduct: ROLLBACK failed:`, rollbackErr.message);
    }
    throw err;
  }
}

async function getProducts() {
  await getDatabase();
  const products = await all('SELECT * FROM products ORDER BY created_at DESC');
  const getBatchesSql = 'SELECT * FROM batches WHERE product_id = ?';
  const getHSNSql = 'SELECT gst_rate FROM hsn_codes WHERE hsn_code = ?';

  const result = [];
  for (const p of products) {
    const batches = await all(getBatchesSql, [p.id]);
    
    // Fetch GST rate from HSN codes if product has HSN
    let gstRate = null;
    if (p.hsn) {
      const hsnData = await get(getHSNSql, [p.hsn]);
      if (hsnData) {
        gstRate = hsnData.gst_rate;
      }
    }
    
    const resultItem = { ...p, batches, gst_rate: gstRate };
    console.log(`[db] getProducts: ${p.name} - HSN: ${p.hsn}, GST Rate: ${gstRate}, Batches: ${batches.length}`);
    result.push(resultItem);
  }
  console.log(`[db] getProducts: Returning ${result.length} products`);
  return result;
}

async function getProductById(id) {
  await getDatabase();
  const product = await get('SELECT * FROM products WHERE id = ?', [id]);
  if (!product) return null;
  const batches = await all('SELECT * FROM batches WHERE product_id = ?', [id]);
  
  // Fetch GST rate from HSN codes if product has HSN
  let gstRate = null;
  if (product.hsn) {
    const hsnData = await get('SELECT gst_rate FROM hsn_codes WHERE hsn_code = ?', [product.hsn]);
    if (hsnData) {
      gstRate = hsnData.gst_rate;
    }
  }
  
  return { ...product, batches, gst_rate: gstRate };
}

async function searchProducts(query) {
  await getDatabase();
  
  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = query.trim().toLowerCase();
    const prefixPattern = `${searchTerm}%`;      // Prefix search: "query%"
    const partialPattern = `%${searchTerm}%`;    // Partial search: "%query%"

    // Search products by name, generic_name, or salt_composition (case-insensitive)
    // Prioritize prefix matches over partial matches using ORDER BY CASE
    const products = await all(
      `SELECT DISTINCT p.* FROM products p
       WHERE 
         LOWER(p.name) LIKE ? OR 
         LOWER(p.name) LIKE ? OR
         LOWER(p.generic_name) LIKE ? OR 
         LOWER(p.generic_name) LIKE ? OR
         LOWER(p.salt_composition) LIKE ? OR 
         LOWER(p.salt_composition) LIKE ?
       ORDER BY 
         CASE
           WHEN LOWER(p.name) LIKE ? THEN 1
           WHEN LOWER(p.generic_name) LIKE ? THEN 2
           WHEN LOWER(p.salt_composition) LIKE ? THEN 3
           ELSE 4
         END ASC,
         p.name ASC
       LIMIT 50`,
      [
        prefixPattern, partialPattern,
        prefixPattern, partialPattern,
        prefixPattern, partialPattern,
        prefixPattern,
        prefixPattern,
        prefixPattern
      ]
    );

    console.log(`[db] searchProducts: Found ${products.length} products for query "${query}"`);

    // Fetch batches and calculate aggregated data for each product
    const result = [];
    for (const p of products) {
      const batches = await all('SELECT * FROM batches WHERE product_id = ? ORDER BY expiry_date ASC', [p.id]);
      
      // Calculate aggregated data from batches
      let total_stock = 0;
      let nearest_expiry = null;
      let cost_price = null;
      let selling_price = null;

      if (batches.length > 0) {
        // Total stock from all batches
        total_stock = batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
        
        // Nearest expiry date (earliest non-null expiry)
        const validExpiries = batches.filter(b => b.expiry_date).map(b => b.expiry_date);
        if (validExpiries.length > 0) {
          nearest_expiry = validExpiries[0]; // Already sorted by expiry_date ASC
        }
        
        // Use cost_price and selling_rate from first batch
        const firstBatch = batches[0];
        cost_price = firstBatch.cost_price;
        selling_price = firstBatch.selling_rate;
      }

      // Fetch GST rate from HSN codes if product has HSN
      let gstRate = null;
      if (p.hsn) {
        const hsnData = await get('SELECT gst_rate FROM hsn_codes WHERE hsn_code = ?', [p.hsn]);
        if (hsnData) {
          gstRate = hsnData.gst_rate;
        }
      }

      result.push({
        ...p,
        batches,
        gst_rate: gstRate,
        total_stock: total_stock,
        nearest_expiry: nearest_expiry,
        cost_price: cost_price,
        selling_price: selling_price,
      });
    }

    return result;
  } catch (error) {
    console.error('[db] searchProducts error:', error);
    throw error;
  }
}

async function deleteProduct(id) {
  await getDatabase();
  try {
    await exec('BEGIN TRANSACTION');
    await run('DELETE FROM batches WHERE product_id = ?', [id]);
    await run('DELETE FROM products WHERE id = ?', [id]);
    await exec('COMMIT');
    console.log(`[db] deleteProduct: SUCCESS - Product ${id} deleted`);
  } catch (err) {
    console.error(`[db] deleteProduct: ERROR - Rolling back:`, err.message);
    try {
      await exec('ROLLBACK');
    } catch (rollbackErr) {
      console.error(`[db] deleteProduct: ROLLBACK failed:`, rollbackErr.message);
    }
    throw err;
  }
}

async function updateProduct(id, productData) {
  await getDatabase();

  try {
    // Verify product exists before updating
    const existingProduct = await get('SELECT id FROM products WHERE id = ?', [id]);
    if (!existingProduct) {
      throw new Error(`Product ${id} not found`);
    }
    
    // Start transaction
    await exec('BEGIN TRANSACTION');
    
    // Update product fields
    const fields = [
      'name',
      'product_type',
      'hsn',
      'generic_name',
      'manufacturer',
      'salt_composition',
      'min_stock_level',
      'unit',
      'description',
    ];

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => productData[f] ?? null);

    await run(`UPDATE products SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...values, id]);

    // Handle batch updates with transaction safety
    if (productData.batches && Array.isArray(productData.batches)) {
      // Get existing batches for this product
      const existingBatches = await all('SELECT * FROM batches WHERE product_id = ?', [id]);
      const existingBatchNumbers = new Set(existingBatches.map(b => b.batch_number));
      const newBatchNumbers = new Set(productData.batches.map(b => b.batch_number));

      // Insert or update batches
      for (const batch of productData.batches) {
        const existing = existingBatches.find(b => b.batch_number === batch.batch_number);
        
        if (existing) {
          // Update existing batch
          await run(`
            UPDATE batches SET 
              mrp = ?, selling_rate = ?, cost_price = ?, 
              quantity = ?, expiry_date = ?, wholesaler_id = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE product_id = ? AND batch_number = ?
          `, [
            batch.mrp,
            batch.selling_rate,
            batch.cost_price,
            batch.quantity,
            batch.expiry_date || null,
            batch.wholesaler_id || null,
            id,
            batch.batch_number,
          ]);
        } else {
          // Insert new batch
          await run(`
            INSERT INTO batches (
              product_id, batch_number, mrp, selling_rate, cost_price, 
              quantity, expiry_date, wholesaler_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id,
            batch.batch_number,
            batch.mrp,
            batch.selling_rate,
            batch.cost_price,
            batch.quantity,
            batch.expiry_date || null,
            batch.wholesaler_id || null,
          ]);
        }
      }

      // Delete batches that were removed
      for (const existing of existingBatches) {
        if (!newBatchNumbers.has(existing.batch_number)) {
          await run('DELETE FROM batches WHERE product_id = ? AND batch_number = ?', [id, existing.batch_number]);
        }
      }
    }

    // Commit transaction
    await exec('COMMIT');
    
    console.log(`[db] updateProduct: SUCCESS - Product ${id} updated`);
    return getProductById(id);
    
  } catch (err) {
    console.error(`[db] updateProduct: ERROR - Rolling back:`, err.message);
    try {
      await exec('ROLLBACK');
    } catch (rollbackErr) {
      console.error(`[db] updateProduct: ROLLBACK failed:`, rollbackErr.message);
    }
    throw err;
  }
}

// Wholesaler functions
async function addWholesaler(wholesalerData) {
  await getDatabase();
  try {
    const res = await run('INSERT INTO wholesalers (name, contactNumber, gstNumber) VALUES (?, ?, ?)', [
      wholesalerData.name,
      wholesalerData.contactNumber || null,
      wholesalerData.gstNumber || null,
    ]);
    return { id: res.lastID, ...wholesalerData };
  } catch (err) {
    // Rethrow for caller to handle
    throw err;
  }
}

async function getWholesalers() {
  await getDatabase();
  return all('SELECT * FROM wholesalers ORDER BY name ASC');
}

async function getWholesalerById(id) {
  await getDatabase();
  return get('SELECT * FROM wholesalers WHERE id = ?', [id]);
}

async function updateWholesaler(id, wholesalerData) {
  await getDatabase();
  await run('UPDATE wholesalers SET name = ?, contactNumber = ?, gstNumber = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
    wholesalerData.name,
    wholesalerData.contactNumber || null,
    wholesalerData.gstNumber || null,
    id,
  ]);
  return getWholesalerById(id);
}

async function deleteWholesaler(id) {
  await getDatabase();
  await run('DELETE FROM wholesalers WHERE id = ?', [id]);
}

// Shop Settings functions
async function getSettings() {
  await getDatabase();
  // Always return the first row (single shop config model)
  const row = await get('SELECT * FROM shop_settings LIMIT 1', []);
  if (!row) {
    // Return default empty object if no row exists
    return {
      shop_name: '',
      owner_name: '',
      phone: '',
      address: '',
      gst_number: '',
      dl_number: '',
    };
  }
  return row;
}

async function saveSettings(settingsData) {
  await getDatabase();
  // Check if a row already exists
  const existing = await get('SELECT id FROM shop_settings LIMIT 1', []);
  
  if (existing) {
    // Update existing row
    await run(`
      UPDATE shop_settings 
      SET shop_name = ?, owner_name = ?, phone = ?, address = ?, gst_number = ?, dl_number = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      settingsData.shop_name || '',
      settingsData.owner_name || '',
      settingsData.phone || '',
      settingsData.address || '',
      settingsData.gst_number || '',
      settingsData.dl_number || '',
      existing.id
    ]);
    return getSettings();
  } else {
    // Insert new row
    const res = await run(`
      INSERT INTO shop_settings (shop_name, owner_name, phone, address, gst_number, dl_number)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      settingsData.shop_name || '',
      settingsData.owner_name || '',
      settingsData.phone || '',
      settingsData.address || '',
      settingsData.gst_number || '',
      settingsData.dl_number || ''
    ]);
    return getSettings();
  }
}

// Product Type functions
async function addProductType(typeData) {
  await getDatabase();
  try {
    const res = await run('INSERT INTO product_types (id, label, is_default) VALUES (?, ?, ?)', [
      typeData.name || typeData.id,
      typeData.label,
      0 // custom types are never defaults
    ]);
    return { id: typeData.name || typeData.id, label: typeData.label, is_default: false };
  } catch (err) {
    throw err;
  }
}

async function getProductTypes() {
  await getDatabase();
  return all('SELECT * FROM product_types ORDER BY is_default DESC, id ASC', []);
}

async function deleteProductType(typeId) {
  await getDatabase();
  // Never allow deleting defaults (check in frontend too)
  const type = await get('SELECT * FROM product_types WHERE id = ?', [typeId]);
  if (type && type.is_default) {
    throw new Error('Cannot delete default product types');
  }
  await run('DELETE FROM product_types WHERE id = ?', [typeId]);
}

// HSN Code functions
async function addHSNCode(hsnData) {
  await getDatabase();
  try {
    const res = await run(
      'INSERT INTO hsn_codes (hsn_code, description, gst_rate, is_active) VALUES (?, ?, ?, ?)',
      [
        hsnData.hsn_code,
        hsnData.description || '',
        hsnData.gst_rate,
        hsnData.is_active !== undefined ? (hsnData.is_active ? 1 : 0) : 1
      ]
    );
    return { hsn_code: hsnData.hsn_code, description: hsnData.description || '', gst_rate: hsnData.gst_rate, is_active: true };
  } catch (err) {
    throw err;
  }
}

async function getHSNCodes() {
  await getDatabase();
  const rows = await all('SELECT * FROM hsn_codes ORDER BY hsn_code ASC', []);
  // Convert is_active from 0/1 to boolean
  return rows.map(row => ({ ...row, is_active: row.is_active === 1 }));
}

async function updateHSNCode(hsnCode, hsnData) {
  await getDatabase();
  const is_active = hsnData.is_active !== undefined ? (hsnData.is_active ? 1 : 0) : 1;
  await run(
    'UPDATE hsn_codes SET description = ?, gst_rate = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE hsn_code = ?',
    [
      hsnData.description || '',
      hsnData.gst_rate,
      is_active,
      hsnCode
    ]
  );
  const updated = await get('SELECT * FROM hsn_codes WHERE hsn_code = ?', [hsnCode]);
  return { ...updated, is_active: updated.is_active === 1 };
}

async function deleteHSNCode(hsnCode) {
  await getDatabase();
  await run('DELETE FROM hsn_codes WHERE hsn_code = ?', [hsnCode]);
}

// Invoice functions
async function createInvoice(invoiceData) {
  await getDatabase();

  try {
    // Calculate total amount
    let totalAmount = 0;
    const itemsWithSubtotals = [];

    // Process items and calculate subtotals + check stock
    for (const item of invoiceData.items) {
      const quantity = parseInt(item.quantity);
      const sellingRate = parseFloat(item.selling_rate);
      const discountPercent = parseFloat(item.discount_percent || 0);
      const gstPercent = parseFloat(item.gst_percent || 0);

      // Calculate item subtotal before discount
      let subtotal = quantity * sellingRate;

      // Get batch to check stock
      const batch = await get(
        'SELECT * FROM batches WHERE product_id = ? AND batch_number = ?',
        [item.product_id, item.batch_number]
      );

      if (!batch) {
        throw new Error(`Batch ${item.batch_number} not found for product ${item.product_id}`);
      }

      if (batch.quantity < quantity) {
        throw new Error(
          `Insufficient stock: ${item.batch_number} has only ${batch.quantity} units, requested ${quantity}`
        );
      }

      itemsWithSubtotals.push({
        ...item,
        subtotal,
        quantity,
        sellingRate,
        discountPercent,
        gstPercent,
      });

      // Accumulate total (before invoice-level discount)
      totalAmount += subtotal;
    }

    // Apply discount percentages
    const invoiceDiscountPercent = parseFloat(invoiceData.discount_percent || 0);
    // Calculate item-level discounts
    let itemDiscountAmount = 0;
    itemsWithSubtotals.forEach(item => {
      itemDiscountAmount += (item.subtotal * item.discountPercent) / 100;
    });
    // Calculate invoice-level discount
    const invoiceLevelDiscountAmount = (totalAmount * invoiceDiscountPercent) / 100;
    const totalDiscountAmount = itemDiscountAmount + invoiceLevelDiscountAmount;
    const taxableAmount = totalAmount - totalDiscountAmount;

    // Calculate GST
    let totalGST = 0;
    itemsWithSubtotals.forEach(item => {
      const itemTaxable = (item.subtotal * (100 - item.discountPercent)) / 100;
      totalGST += (itemTaxable * item.gstPercent) / 100;
    });

    const finalTotal = taxableAmount + totalGST;

    // Insert invoice
    const invoiceRes = await run(
      `INSERT INTO invoices (
        customer_name, customer_phone, customer_dl_number, customer_address, 
        notes, discount_percent, total_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceData.customer_name,
        invoiceData.customer_phone || '',
        invoiceData.customer_dl_number || '',
        invoiceData.customer_address || '',
        invoiceData.notes || '',
        invoiceDiscountPercent,
        finalTotal,
      ]
    );

    const invoiceId = invoiceRes.lastID;

    // Insert items and deduct stock from batches
    const savedItems = [];
    for (const item of itemsWithSubtotals) {
      // Get product name to store with item
      const product = await get('SELECT name FROM products WHERE id = ?', [item.product_id]);
      const productName = product ? String(product.name).trim() : ''; // Ensure it's a non-empty string, never "0"
      
      // Use expiry_date from form if provided, otherwise fetch from batch
      let expiryDate = item.expiry_date || null;
      if (!expiryDate) {
        const batch = await get(
          'SELECT expiry_date FROM batches WHERE product_id = ? AND batch_number = ?',
          [item.product_id, item.batch_number]
        );
        expiryDate = batch ? batch.expiry_date : null;
      }
      
      console.log(`[db] createInvoice: Adding item - Product: "${productName}", HSN: "${item.hsn_code}", Expiry: "${expiryDate}"`);
      
      const itemRes = await run(
        `INSERT INTO invoice_items (
          invoice_id, product_id, product_name, batch_number, quantity,
          original_selling_rate, selling_rate, mrp, hsn_code,
          discount_percent, gst_percent, is_return, return_reason, subtotal, expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          item.product_id,
          productName,
          item.batch_number,
          item.quantity,
          item.original_selling_rate || item.sellingRate,
          item.sellingRate,
          item.mrp || null,
          item.hsn_code || null,
          item.discountPercent,
          item.gstPercent,
          item.is_return ? 1 : 0,
          item.return_reason || '',
          item.subtotal,
          expiryDate || null,
        ]
      );

      // Deduct stock from batch
      await run(
        'UPDATE batches SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND batch_number = ?',
        [item.quantity, item.product_id, item.batch_number]
      );

      savedItems.push({
        id: itemRes.lastID,
        ...item,
      });
    }

    // Return complete invoice object
    return getInvoiceById(invoiceId);
  } catch (err) {
    throw err;
  }
}

async function getInvoices() {
  await getDatabase();
  const invoices = await all(
    'SELECT * FROM invoices ORDER BY created_at DESC',
    []
  );

  const result = [];
  for (const inv of invoices) {
    const items = await all(
      'SELECT * FROM invoice_items WHERE invoice_id = ?',
      [inv.id]
    );
    result.push({ ...inv, items });
  }
  return result;
}

async function getInvoiceById(id) {
  await getDatabase();
  const invoice = await get('SELECT * FROM invoices WHERE id = ?', [id]);
  if (!invoice) return null;

  const items = await all(
    'SELECT * FROM invoice_items WHERE invoice_id = ?',
    [id]
  );

  return { ...invoice, items };
}

async function deleteInvoice(id) {
  await getDatabase();

  // Get invoice with items to restore stock
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    throw new Error(`Invoice ${id} not found`);
  }

  // Restore stock for all items
  for (const item of invoice.items) {
    await run(
      'UPDATE batches SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND batch_number = ?',
      [item.quantity, item.product_id, item.batch_number]
    );
  }

  // Delete invoice items
  await run('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);

  // Delete invoice
  await run('DELETE FROM invoices WHERE id = ?', [id]);
}

async function updateInvoice(id, invoiceData) {
  await getDatabase();

  // Update only metadata (customer info, notes)
  await run(
    `UPDATE invoices SET 
      customer_name = ?, customer_phone = ?, customer_dl_number = ?, 
      customer_address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?`,
    [
      invoiceData.customer_name || '',
      invoiceData.customer_phone || '',
      invoiceData.customer_dl_number || '',
      invoiceData.customer_address || '',
      invoiceData.notes || '',
      id,
    ]
  );

  return getInvoiceById(id);
}

// ========== DASHBOARD AGGREGATION FUNCTIONS ==========

async function getDashboardSummary() {
  await getDatabase();
  try {
    // Total products count
    const productsCount = await get('SELECT COUNT(*) as count FROM products');
    const totalProducts = productsCount?.count || 0;

    // Recent invoices count
    const invoicesCount = await get('SELECT COUNT(*) as count FROM invoices');
    const recentInvoices = invoicesCount?.count || 0;

    return {
      success: true,
      data: {
        totalProducts: totalProducts,
        recentInvoices: recentInvoices,
      },
    };
  } catch (error) {
    console.error('[db] getDashboardSummary error:', error);
    throw error;
  }
}

async function getLowStockItems() {
  await getDatabase();
  try {
    // Query products with low stock
    const query = `
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.product_type,
        p.min_stock_level,
        COALESCE(SUM(b.quantity), 0) as current_stock
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      GROUP BY p.id, p.name, p.product_type, p.min_stock_level
      HAVING current_stock <= p.min_stock_level
      ORDER BY (p.min_stock_level - current_stock) DESC
    `;

    const lowStockProducts = await all(query);

    // Build response with severity levels
    const items = lowStockProducts.map(item => {
      const unitsBelow = item.min_stock_level - item.current_stock;
      const severity = unitsBelow > item.min_stock_level * 0.5 ? 'critical' : 'warning';

      return {
        product_id: item.product_id,
        product_name: item.product_name,
        product_type: item.product_type,
        current_stock: item.current_stock,
        min_stock_level: item.min_stock_level,
        units_below: unitsBelow,
        severity: severity,
      };
    });

    return {
      success: true,
      data: {
        count: items.length,
        low_stock_items: items,
      },
    };
  } catch (error) {
    console.error('[db] getLowStockItems error:', error);
    throw error;
  }
}

async function getExpiryOverview(months = 1) {
  await getDatabase();
  try {
    // Calculate date range (today to today + N months)
    const today = new Date();
    const expiryDate = new Date(today.getFullYear(), today.getMonth() + months, today.getDate());
    const fromDate = today.toISOString().split('T')[0];
    const toDate = expiryDate.toISOString().split('T')[0];

    const query = `
      SELECT 
        b.id,
        b.batch_number,
        b.quantity,
        b.expiry_date,
        p.name as product_name,
        p.product_type
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.expiry_date IS NOT NULL 
        AND b.expiry_date >= ? 
        AND b.expiry_date <= ?
        AND b.quantity > 0
      ORDER BY b.expiry_date ASC
    `;

    const batches = await all(query, [fromDate, toDate]);

    return {
      success: true,
      data: {
        batches: batches || [],
      },
    };
  } catch (error) {
    console.error('[db] getExpiryOverview error:', error);
    throw error;
  }
}

async function getSalesOverview(period = 'month') {
  await getDatabase();
  try {
    let query = '';
    let params = [];

    if (period === 'year') {
      const currentYear = new Date().getFullYear();
      query = `
        SELECT 
          COALESCE(SUM(total_amount), 0) as total_sales,
          COUNT(*) as bill_count
        FROM invoices
        WHERE strftime('%Y', created_at) = ?
      `;
      params = [currentYear.toString()];
    } else {
      // Default to month
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
      query = `
        SELECT 
          COALESCE(SUM(total_amount), 0) as total_sales,
          COUNT(*) as bill_count
        FROM invoices
        WHERE strftime('%Y-%m', created_at) = ?
      `;
      params = [`${currentYear}-${currentMonth}`];
    }

    const result = await get(query, params);

    return {
      success: true,
      data: {
        total_sales: result?.total_sales || 0,
        total_paid: 0, // TODO: Track payments separately if needed
        total_due: 0,  // TODO: Track due amounts separately if needed
        bill_count: result?.bill_count || 0,
      },
    };
  } catch (error) {
    console.error('[db] getSalesOverview error:', error);
    throw error;
  }
}

async function getPurchaseOverview(period = 'month') {
  await getDatabase();
  try {
    let query = '';
    let params = [];

    if (period === 'year') {
      const currentYear = new Date().getFullYear();
      query = `
        SELECT 
          COALESCE(SUM(total_amount), 0) as total_purchases,
          COALESCE(SUM(amount_paid), 0) as total_paid,
          COALESCE(SUM(CASE WHEN amount_due IS NOT NULL THEN amount_due ELSE 0 END), 0) as total_due,
          COUNT(*) as bill_count
        FROM purchase_bills
        WHERE strftime('%Y', created_at) = ?
      `;
      params = [currentYear.toString()];
    } else {
      // Default to month
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
      query = `
        SELECT 
          COALESCE(SUM(total_amount), 0) as total_purchases,
          COALESCE(SUM(amount_paid), 0) as total_paid,
          COALESCE(SUM(CASE WHEN amount_due IS NOT NULL THEN amount_due ELSE 0 END), 0) as total_due,
          COUNT(*) as bill_count
        FROM purchase_bills
        WHERE strftime('%Y-%m', created_at) = ?
      `;
      params = [`${currentYear}-${currentMonth}`];
    }

    const result = await get(query, params);

    return {
      success: true,
      data: {
        total_purchases: result?.total_purchases || 0,
        total_paid: result?.total_paid || 0,
        total_due: result?.total_due || 0,
        bill_count: result?.bill_count || 0,
      },
    };
  } catch (error) {
    console.error('[db] getPurchaseOverview error:', error);
    throw error;
  }
}

// ========== PURCHASE BILL CRUD FUNCTIONS ==========

async function createPurchaseBill(billData) {
  await getDatabase();

  try {
    // Parse and validate numeric values
    const total_amount = parseFloat(billData.total_amount) || 0;
    const amount_paid = parseFloat(billData.amount_paid) || 0;
    const amount_due = total_amount - amount_paid;

    // Handle wholesaler: look up by name or create if doesn't exist
    let wholesaler_id = billData.wholesaler_id;
    
    if (!wholesaler_id && billData.wholesaler_name) {
      // Try to find existing wholesaler by name
      const existing = await get(
        'SELECT id FROM wholesalers WHERE name = ?',
        [billData.wholesaler_name]
      );
      
      if (existing) {
        wholesaler_id = existing.id;
      } else {
        // Create new wholesaler if it doesn't exist
        const result = await run(
          'INSERT INTO wholesalers (name, contactNumber, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [billData.wholesaler_name, billData.contact_number || null]
        );
        wholesaler_id = result.lastID;
      }
    }

    if (!wholesaler_id) {
      throw new Error('Wholesaler ID or name is required');
    }

    // Insert purchase bill
    const result = await run(
      `INSERT INTO purchase_bills (
        bill_number, purchase_date, wholesaler_id, total_amount, 
        amount_paid, amount_due, payment_status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        billData.bill_number || null,
        billData.purchase_date || null,
        wholesaler_id,
        total_amount,
        amount_paid,
        amount_due,
        amount_paid >= total_amount ? 'paid' : (amount_paid > 0 ? 'partial' : 'unpaid'),
        billData.notes || null,
      ]
    );

    // Fetch the created bill with wholesaler info
    const bill = await get(
      `SELECT 
        pb.id, pb.bill_number, pb.purchase_date, pb.total_amount, 
        pb.amount_paid, pb.amount_due, pb.payment_status, pb.notes,
        w.name as wholesaler_name, w.contactNumber as wholesaler_contact
      FROM purchase_bills pb
      LEFT JOIN wholesalers w ON pb.wholesaler_id = w.id
      WHERE pb.id = ?`,
      [result.lastID]
    );

    // Ensure all numeric fields are properly converted
    return {
      id: bill.id,
      bill_number: bill.bill_number || '',
      purchase_date: bill.purchase_date || '',
      wholesaler_name: bill.wholesaler_name || '',
      wholesaler_contact: bill.wholesaler_contact || '',
      total_amount: parseFloat(bill.total_amount) || 0,
      amount_paid: parseFloat(bill.amount_paid) || 0,
      amount_due: parseFloat(bill.amount_due) || 0,
      payment_status: bill.payment_status || 'unpaid',
      notes: bill.notes || '',
    };
  } catch (error) {
    console.error('[db] createPurchaseBill error:', error);
    throw error;
  }
}

async function getPurchaseBills() {
  await getDatabase();

  try {
    const bills = await all(
      `SELECT 
        pb.id, pb.bill_number, pb.purchase_date, pb.total_amount, 
        pb.amount_paid, pb.amount_due, pb.payment_status, pb.notes,
        w.name as wholesaler_name, w.contactNumber as wholesaler_contact
      FROM purchase_bills pb
      LEFT JOIN wholesalers w ON pb.wholesaler_id = w.id
      ORDER BY pb.created_at DESC`
    );

    // Ensure all numeric fields are properly converted
    return (bills || []).map(bill => ({
      id: bill.id,
      bill_number: bill.bill_number || '',
      purchase_date: bill.purchase_date || '',
      wholesaler_name: bill.wholesaler_name || '',
      wholesaler_contact: bill.wholesaler_contact || '',
      total_amount: parseFloat(bill.total_amount) || 0,
      amount_paid: parseFloat(bill.amount_paid) || 0,
      amount_due: parseFloat(bill.amount_due) || 0,
      payment_status: bill.payment_status || 'unpaid',
      notes: bill.notes || '',
    }));
  } catch (error) {
    console.error('[db] getPurchaseBills error:', error);
    throw error;
  }
}

async function updatePurchaseBill(id, billData) {
  await getDatabase();

  try {
    // Verify bill exists
    const existingBill = await get('SELECT id FROM purchase_bills WHERE id = ?', [id]);
    if (!existingBill) {
      throw new Error(`Purchase bill ${id} not found`);
    }

    // Parse numeric values
    const amount_paid = parseFloat(billData.amount_paid);
    
    // Fetch current total_amount to calculate amount_due
    const current = await get('SELECT total_amount FROM purchase_bills WHERE id = ?', [id]);
    const total_amount = parseFloat(current.total_amount) || 0;
    const amount_due = total_amount - amount_paid;
    const payment_status = amount_paid >= total_amount ? 'paid' : (amount_paid > 0 ? 'partial' : 'unpaid');

    // Update purchase bill
    await run(
      `UPDATE purchase_bills SET 
        amount_paid = ?, amount_due = ?, payment_status = ?,
        notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        amount_paid,
        amount_due,
        payment_status,
        billData.notes || null,
        id,
      ]
    );

    // Fetch and return updated bill with wholesaler info
    const bill = await get(
      `SELECT 
        pb.id, pb.bill_number, pb.purchase_date, pb.total_amount, 
        pb.amount_paid, pb.amount_due, pb.payment_status, pb.notes,
        w.name as wholesaler_name, w.contactNumber as wholesaler_contact
      FROM purchase_bills pb
      LEFT JOIN wholesalers w ON pb.wholesaler_id = w.id
      WHERE pb.id = ?`,
      [id]
    );

    // Ensure all numeric fields are properly converted
    return {
      id: bill.id,
      bill_number: bill.bill_number || '',
      purchase_date: bill.purchase_date || '',
      wholesaler_name: bill.wholesaler_name || '',
      wholesaler_contact: bill.wholesaler_contact || '',
      total_amount: parseFloat(bill.total_amount) || 0,
      amount_paid: parseFloat(bill.amount_paid) || 0,
      amount_due: parseFloat(bill.amount_due) || 0,
      payment_status: bill.payment_status || 'unpaid',
      notes: bill.notes || '',
    };
  } catch (error) {
    console.error('[db] updatePurchaseBill error:', error);
    throw error;
  }
}

async function deletePurchaseBill(id) {
  await getDatabase();

  try {
    // Verify bill exists
    const bill = await get('SELECT id FROM purchase_bills WHERE id = ?', [id]);
    if (!bill) {
      throw new Error(`Purchase bill ${id} not found`);
    }

    // Delete the purchase bill
    await run('DELETE FROM purchase_bills WHERE id = ?', [id]);

    // Verify deletion
    const deleted = await get('SELECT id FROM purchase_bills WHERE id = ?', [id]);
    if (deleted) {
      throw new Error(`Failed to delete purchase bill ${id}`);
    }

    return { success: true, id };
  } catch (error) {
    console.error('[db] deletePurchaseBill error:', error);
    throw error;
  }
}

async function getRecentInvoices(limit = 10) {
  await getDatabase();
  try {
    const query = `
      SELECT 
        id,
        customer_name,
        customer_phone,
        total_amount,
        created_at,
        updated_at
      FROM invoices
      ORDER BY created_at DESC
      LIMIT ?
    `;

    const invoices = await all(query, [limit]);

    return {
      success: true,
      data: {
        invoices: invoices || [],
      },
    };
  } catch (error) {
    console.error('[db] getRecentInvoices error:', error);
    throw error;
  }
}

// Authentication functions
const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function ownerExists() {
  await getDatabase();
  try {
    const owner = await get('SELECT id FROM owners WHERE is_active = 1 LIMIT 1');
    return !!owner;
  } catch (error) {
    console.error('[db] ownerExists error:', error);
    return false;
  }
}

async function verifyOwnerByUsername(username) {
  await getDatabase();
  try {
    const owner = await get(
      'SELECT id, username, email, first_name, last_name FROM owners WHERE (username = ? OR email = ?) AND is_active = 1',
      [username.toLowerCase(), username.toLowerCase()]
    );
    if (!owner) {
      return null;
    }
    return {
      id: owner.id,
      username: owner.username,
      email: owner.email,
      first_name: owner.first_name,
      last_name: owner.last_name,
    };
  } catch (error) {
    console.error('[db] verifyOwnerByUsername error:', error);
    return null;
  }
}

async function getOwner() {
  await getDatabase();
  try {
    const owner = await get('SELECT * FROM owners WHERE is_active = 1 LIMIT 1');
    return owner || null;
  } catch (error) {
    console.error('[db] getOwner error:', error);
    return null;
  }
}

async function registerOwner(username, email, password, firstName = '', lastName = '') {
  await getDatabase();
  try {
    // Check if owner already exists
    const existing = await get('SELECT id FROM owners WHERE is_active = 1 LIMIT 1');
    if (existing) {
      throw new Error('Owner account already exists');
    }

    const passwordHash = hashPassword(password);
    
    // Developer-controlled recovery code (fixed by developer)
    const developerRecoveryCode = "Volley@921";
    const recoveryCodeHash = hashPassword(developerRecoveryCode);
    
    const result = await run(
      `INSERT INTO owners (username, email, password_hash, recovery_code_hash, first_name, last_name, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [username.toLowerCase(), email.toLowerCase(), passwordHash, recoveryCodeHash, firstName, lastName]
    );

    console.log('[db] Owner registered successfully');
    
    return {
      id: result.lastID,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      first_name: firstName,
      last_name: lastName,
    };
  } catch (error) {
    console.error('[db] registerOwner error:', error);
    throw error;
  }
}

async function loginOwner(username, password) {
  await getDatabase();
  try {
    const passwordHash = hashPassword(password);
    
    const owner = await get(
      `SELECT * FROM owners WHERE (username = ? OR email = ?) AND is_active = 1 AND password_hash = ?`,
      [username.toLowerCase(), username.toLowerCase(), passwordHash]
    );

    if (!owner) {
      throw new Error('Invalid credentials');
    }

    console.log('[db] Owner login successful:', owner.username);
    
    return {
      id: owner.id,
      username: owner.username,
      email: owner.email,
      first_name: owner.first_name,
      last_name: owner.last_name,
    };
  } catch (error) {
    console.error('[db] loginOwner error:', error);
    throw error;
  }
}

async function resetPasswordWithRecoveryCode(username, recoveryCode, newPassword) {
  await getDatabase();
  try {
    const recoveryCodeHash = hashPassword(recoveryCode);
    const newPasswordHash = hashPassword(newPassword);

    // Verify recovery code first
    const owner = await get(
      `SELECT * FROM owners WHERE (username = ? OR email = ?) AND is_active = 1 AND recovery_code_hash = ?`,
      [username.toLowerCase(), username.toLowerCase(), recoveryCodeHash]
    );

    if (!owner) {
      throw new Error('Invalid recovery code');
    }

    // Update password
    const result = await run(
      `UPDATE owners SET password_hash = ? WHERE id = ?`,
      [newPasswordHash, owner.id]
    );

    if (result.changes === 0) {
      throw new Error('Failed to reset password');
    }

    console.log('[db] Password reset with recovery code successful');
    
    return {
      id: owner.id,
      username: owner.username,
      email: owner.email,
      first_name: owner.first_name,
      last_name: owner.last_name,
    };
  } catch (error) {
    console.error('[db] resetPasswordWithRecoveryCode error:', error);
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  addProduct,
  getProducts,
  getProductById,
  searchProducts,
  deleteProduct,
  updateProduct,
  addWholesaler,
  getWholesalers,
  getWholesalerById,
  updateWholesaler,
  deleteWholesaler,
  getSettings,
  saveSettings,
  addProductType,
  getProductTypes,
  deleteProductType,
  addHSNCode,
  getHSNCodes,
  updateHSNCode,
  deleteHSNCode,
  createInvoice,
  getInvoices,
  getInvoiceById,
  deleteInvoice,
  updateInvoice,
  getDashboardSummary,
  getLowStockItems,
  getExpiryOverview,
  getSalesOverview,
  getPurchaseOverview,
  getRecentInvoices,
  createPurchaseBill,
  getPurchaseBills,
  updatePurchaseBill,
  deletePurchaseBill,
  ownerExists,
  verifyOwnerByUsername,
  getOwner,
  registerOwner,
  loginOwner,
  resetPasswordWithRecoveryCode,
};
