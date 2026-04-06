// Database layer migrated from sqlite3 callbacks/promises to better-sqlite3
// All operations now use synchronous prepared statements and run in Electron main process only.
// Callers may still use async/await but the underlying calls are synchronous.

// Note: better-sqlite3 is a native module and must be properly included in the Electron build process.
// Make sure to install it with npm and configure electron-builder to include it in the final package.
// In development, it should work out of the box. In production, ensure that the asar packaging does not break the native module loading.
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

let Database;
try {
  if (process.resourcesPath) {
    const unpackedPath = path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "node_modules",
      "better-sqlite3",
    );
    if (fs.existsSync(unpackedPath)) {
      Database = require(unpackedPath);
      console.log(
        "[db] Loaded better-sqlite3 from asar.unpacked:",
        unpackedPath,
      );
    } else {
      Database = require("better-sqlite3");
      console.log("[db] Loaded better-sqlite3 from node_modules (fallback)");
    }
  } else {
    Database = require("better-sqlite3");
    console.log("[db] Loaded better-sqlite3 from node_modules (dev)");
  }
} catch (err) {
  console.error("[db] Failed to load better-sqlite3:", err.message);
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

  const dbPath = path.join(app.getPath("userData"), "electrical_store.db");
  console.log("[database] Initializing better-sqlite3 at:", dbPath);

  try {
    db = new Database(dbPath);
  } catch (err) {
    console.error("[database] Failed to open database:", err);
    db = null;
    throw err;
  }

  // enable foreign key constraints
  db.pragma("foreign_keys = ON");
  console.log("[database] Foreign key constraints enabled");

  // Create tables sequentially
  run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      product_type TEXT NOT NULL,
      hsn TEXT,
      manufacturer TEXT,
      min_stock_level INTEGER DEFAULT 10,
      unit TEXT DEFAULT 'PCS',
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Check if batches table exists with old schema
  const batchesCheck = get(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='batches'",
  );

  if (!batchesCheck) {
    // Create batches table with composite UNIQUE constraint (product_id, batch_number)
    run(`
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
  } else if (batchesCheck.sql.includes("batch_number TEXT NOT NULL UNIQUE")) {
    console.log(
      "[database] Migrating batches table to fix UNIQUE constraint...",
    );
    // Migrate old schema - drop & recreate
    try {
      run("DROP TABLE IF EXISTS batches");
      run(`
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
      console.log("[database] Schema migration completed");
    } catch (err) {
      console.warn("[database] Could not migrate schema:", err.message);
    }
  }

  run(`
    CREATE TABLE IF NOT EXISTS wholesalers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      contactNumber TEXT,
      gstNumber TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  run(`
    CREATE TABLE IF NOT EXISTS shop_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_name TEXT,
      owner_name TEXT,
      phone TEXT,
      address TEXT,
      gst_number TEXT,
      bank_holder TEXT,
      bank_name TEXT,
      bank_account TEXT,
      bank_ifsc TEXT,
      bank_qr_path TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add missing columns if they don't exist (for existing databases)
  try {
    run(`ALTER TABLE shop_settings ADD COLUMN bank_holder TEXT;`);
  } catch (e) {
    /* column may already exist */
  }
  try {
    run(`ALTER TABLE shop_settings ADD COLUMN bank_name TEXT;`);
  } catch (e) {
    /* column may already exist */
  }
  try {
    run(`ALTER TABLE shop_settings ADD COLUMN bank_account TEXT;`);
  } catch (e) {
    /* column may already exist */
  }
  try {
    run(`ALTER TABLE shop_settings ADD COLUMN bank_ifsc TEXT;`);
  } catch (e) {
    /* column may already exist */
  }
  try {
    run(`ALTER TABLE shop_settings ADD COLUMN bank_qr_path TEXT;`);
  } catch (e) {
    /* column may already exist */
  }

  run(`
    CREATE TABLE IF NOT EXISTS product_types (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  run(`
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
    run("ALTER TABLE invoice_items ADD COLUMN product_name TEXT");
  } catch (err) {
    // Column likely already exists, ignore error
  }

  // Add expiry_date column to invoice_items if it doesn't exist
  try {
    run("ALTER TABLE invoice_items ADD COLUMN expiry_date TEXT");
  } catch (err) {
    // Column likely already exists, ignore error
  }

  // Add new billing fields to invoices table for electrical shop (CHANGE 2-5)
  try {
    run("ALTER TABLE invoices ADD COLUMN bill_to_gstin VARCHAR(20)");
  } catch (err) {
    // Column likely already exists, ignore error
  }

  try {
    run("ALTER TABLE invoices ADD COLUMN bill_to_state VARCHAR(100)");
  } catch (err) {
    // Column likely already exists, ignore error
  }

  try {
    run("ALTER TABLE invoices ADD COLUMN ship_same_as_bill BOOLEAN DEFAULT 1");
  } catch (err) {
    // Column likely already exists, ignore error
  }

  try {
    run("ALTER TABLE invoices ADD COLUMN ship_to_name VARCHAR(255)");
  } catch (err) {
    // Column likely already exists, ignore error
  }

  try {
    run("ALTER TABLE invoices ADD COLUMN ship_to_address TEXT");
  } catch (err) {
    // Column likely already exists, ignore error
  }

  try {
    run("ALTER TABLE invoices ADD COLUMN ship_to_gstin VARCHAR(20)");
  } catch (err) {
    // Column likely already exists, ignore error
  }

  try {
    run("ALTER TABLE invoices ADD COLUMN ship_to_state VARCHAR(100)");
  } catch (err) {
    // Column likely already exists, ignore error
  }

  try {
    run("ALTER TABLE invoices ADD COLUMN place_of_supply VARCHAR(100)");
  } catch (err) {
    // Column likely already exists, ignore error
  }

  try {
    run("ALTER TABLE invoices ADD COLUMN eway_bill_no VARCHAR(50)");
  } catch (err) {
    // Column likely already exists, ignore error
  }

  // Remove old customer_dl_number column if it exists (CHANGE 1)
  // Note: SQLite doesn't support DROP COLUMN directly for older versions,
  // so we leave it but it won't be used in new code

  run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      phone_number TEXT,
      bill_to_address TEXT,
      bill_to_gstin VARCHAR(20),
      bill_to_state VARCHAR(100),
      ship_to_name VARCHAR(255),
      ship_to_address TEXT,
      ship_to_gstin VARCHAR(20),
      ship_to_state VARCHAR(100),
      discount REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(customer_name, phone_number)
    );
  `);

  run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      customer_address TEXT,
      bill_to_name TEXT,
      bill_to_phone TEXT,
      bill_to_gstin VARCHAR(20),
      bill_to_state VARCHAR(100),
      ship_same_as_bill BOOLEAN DEFAULT 1,
      ship_to_name VARCHAR(255),
      ship_to_phone TEXT,
      ship_to_address TEXT,
      ship_to_gstin VARCHAR(20),
      ship_to_state VARCHAR(100),
      place_of_supply VARCHAR(100),
      eway_bill_no VARCHAR(50),
      invoice_number TEXT,
      notes TEXT,
      discount_percent REAL DEFAULT 0,
      tax_type TEXT DEFAULT 'gst',
      total_amount REAL NOT NULL,
      customer_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
`);

  // Add customer_id column to invoices if it doesn't exist (for existing databases)
  try {
    run(
      "ALTER TABLE invoices ADD COLUMN customer_id INTEGER REFERENCES customers(id)",
    );
  } catch (err) {
    // Column likely already exists, ignore error
  }

  // Add invoice_number column to invoices if it doesn't exist (for existing databases)
  try {
    run("ALTER TABLE invoices ADD COLUMN invoice_number TEXT");
  } catch (err) {
    // Column likely already exists, ignore error
  }
  // Add tax_type column to invoices (for IGST vs CGST+SGST selection)
  try {
    run("ALTER TABLE invoices ADD COLUMN tax_type TEXT DEFAULT 'gst'");
    console.log("[database] Added tax_type column to invoices");
  } catch (err) {
    // Column already exists — ignore
  }

  // Add bill_to_name column to invoices
  try {
    run("ALTER TABLE invoices ADD COLUMN bill_to_name TEXT");
  } catch (err) {
    // Column already exists — ignore
  }

  // Add bill_to_phone column to invoices
  try {
    run("ALTER TABLE invoices ADD COLUMN bill_to_phone TEXT");
  } catch (err) {
    // Column already exists — ignore
  }

  // Add ship_to_phone column to invoices
  try {
    run("ALTER TABLE invoices ADD COLUMN ship_to_phone TEXT");
  } catch (err) {
    // Column already exists — ignore
  }
  run(`
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

  run(`
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
  run(`
    CREATE TABLE IF NOT EXISTS owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("[database] Database initialized successfully (better-sqlite3)");
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
    exec("BEGIN TRANSACTION");

    const insertSql = `
      INSERT INTO products (
        name, product_type, hsn, manufacturer, 
        min_stock_level, unit, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const res = run(insertSql, [
      productData.name,
      productData.product_type || "general",
      productData.hsn || null,
      productData.manufacturer || null,
      productData.min_stock_level ?? 10,
      productData.unit || "PCS",
      productData.description || null,
    ]);

    const productId = res.lastID;
    console.log(`[db] addProduct: Created product ${productId}`);

    const savedBatches = [];
    if (productData.batches && Array.isArray(productData.batches)) {
      for (let i = 0; i < productData.batches.length; i++) {
        const batch = productData.batches[i];
        try {
          // Auto-generate batch_number — frontend no longer collects it
          const autoBatchNumber = `AUTO-${productId}-${Date.now()}-${i}`;
          const mrp = parseFloat(batch.mrp) || 0;

          const batchRes = run(
            `
        INSERT INTO batches (
          product_id, batch_number, mrp, selling_rate, cost_price,
          quantity, expiry_date, wholesaler_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
            [
              productId,
              autoBatchNumber,
              mrp,
              mrp, // selling_rate = MRP by default, discount applied at billing
              0, // cost_price not collected anymore
              batch.quantity || 0,
              null, // expiry_date not collected anymore
              batch.wholesaler_id || null,
            ],
          );

          savedBatches.push({
            id: batchRes.lastID,
            ...batch,
            batch_number: autoBatchNumber,
          });
        } catch (batchErr) {
          console.error(
            `[db] addProduct: Batch insert failed, rolling back:`,
            batchErr.message,
          );
          throw batchErr;
        }
      }
    }

    // Fetch the complete product from database
    const product = get("SELECT * FROM products WHERE id = ?", [productId]);
    if (!product) {
      throw new Error(`Failed to fetch product ${productId} after insert`);
    }

    // Fetch GST rate from HSN
    let gstRate = null;
    if (product.hsn) {
      const hsnData = get("SELECT gst_rate FROM hsn_codes WHERE hsn_code = ?", [
        product.hsn,
      ]);
      if (hsnData) {
        gstRate = hsnData.gst_rate;
      }
    }

    // Commit transaction
    exec("COMMIT");

    console.log(
      `[db] addProduct: SUCCESS - Product ${productId} with ${savedBatches.length} batches`,
    );
    return { ...product, batches: savedBatches, gst_rate: gstRate };
  } catch (err) {
    console.error(`[db] addProduct: ERROR - Rolling back:`, err.message);
    try {
      exec("ROLLBACK");
    } catch (rollbackErr) {
      console.error(`[db] addProduct: ROLLBACK failed:`, rollbackErr.message);
    }
    throw err;
  }
}

async function getProducts() {
  await getDatabase();
  const products = all("SELECT * FROM products ORDER BY created_at DESC");
  const getBatchesSql =
    "SELECT * FROM batches WHERE product_id = ? ORDER BY created_at ASC";
  const getHSNSql = "SELECT gst_rate FROM hsn_codes WHERE hsn_code = ?";

  const result = [];
  for (const p of products) {
    const batches = all(getBatchesSql, [p.id]);

    // Fetch GST rate from HSN codes if product has HSN
    let gstRate = null;
    if (p.hsn) {
      const hsnData = get(getHSNSql, [p.hsn]);
      if (hsnData) {
        gstRate = hsnData.gst_rate;
      }
    }

    const resultItem = { ...p, batches, gst_rate: gstRate };
    result.push(resultItem);
  }
  console.log(`[db] getProducts: Returning ${result.length} products`);
  return result;
}

async function getProductById(id) {
  await getDatabase();
  const product = get("SELECT * FROM products WHERE id = ?", [id]);
  if (!product) return null;
  const batches = all("SELECT * FROM batches WHERE product_id = ?", [id]);

  // Fetch GST rate from HSN codes if product has HSN
  let gstRate = null;
  if (product.hsn) {
    const hsnData = get("SELECT gst_rate FROM hsn_codes WHERE hsn_code = ?", [
      product.hsn,
    ]);
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
    const prefixPattern = `${searchTerm}%`;
    const partialPattern = `%${searchTerm}%`;

    const products = all(
      `SELECT DISTINCT p.* FROM products p
      WHERE 
        LOWER(p.name) LIKE ? OR
        LOWER(p.name) LIKE ?
      ORDER BY
        CASE
          WHEN LOWER(p.name) LIKE ? THEN 1
          ELSE 2
        END ASC,
        p.name ASC
      LIMIT 50`,
      [prefixPattern, partialPattern, prefixPattern],
    );

    console.log(
      `[db] searchProducts: Found ${products.length} products for query "${query}"`,
    );

    const result = [];
    for (const p of products) {
      // ✅ CHANGED: removed ORDER BY expiry_date (always null)
      const batches = all(
        "SELECT * FROM batches WHERE product_id = ? ORDER BY created_at ASC",
        [p.id],
      );

      // Total stock
      const total_stock = batches.reduce(
        (sum, b) => sum + (b.quantity || 0),
        0,
      );

      // ✅ ADDED: Max MRP across all batches
      const max_mrp =
        batches.length > 0
          ? Math.max(...batches.map((b) => parseFloat(b.mrp || 0)))
          : 0;

      // GST rate from HSN
      let gstRate = null;
      if (p.hsn) {
        const hsnData = get(
          "SELECT gst_rate FROM hsn_codes WHERE hsn_code = ?",
          [p.hsn],
        );
        if (hsnData) gstRate = hsnData.gst_rate;
      }

      result.push({
        ...p, // includes p.unit, p.name, p.hsn etc.
        batches,
        gst_rate: gstRate,
        total_stock: total_stock,
        mrp: max_mrp, // ✅ ADDED
      });
    }

    return result;
  } catch (error) {
    console.error("[db] searchProducts error:", error);
    throw error;
  }
}

async function deleteProduct(id) {
  await getDatabase();
  try {
    exec("BEGIN TRANSACTION");

    // Step 1: Delete invoice_items linked directly to this product
    try {
      run("DELETE FROM invoice_items WHERE product_id = ?", [id]);
    } catch (e) {
      console.warn(
        "[db] deleteProduct: invoice_items table missing or no direct product items",
        e.message,
      );
    }

    // Step 2: Delete invoice_items linked to batch numbers associated with this product
    try {
      const batches = all(
        "SELECT id, batch_number FROM batches WHERE product_id = ?",
        [id],
      );
      for (const batch of batches) {
        run(
          "DELETE FROM invoice_items WHERE batch_number = ? AND product_id = ?",
          [batch.batch_number, id],
        );
      }
    } catch (e) {
      console.warn(
        "[db] deleteProduct: failed to delete invoice_items by batch references",
        e.message,
      );
    }

    // Step 3: Delete batches for this product
    try {
      run("DELETE FROM batches WHERE product_id = ?", [id]);
    } catch (e) {
      console.warn(
        "[db] deleteProduct: batches table missing or no batches for product",
        e.message,
      );
    }

    // Step 4: Delete product
    const result = run("DELETE FROM products WHERE id = ?", [id]);

    exec("COMMIT");
    console.log(`[db] deleteProduct: SUCCESS - Product ${id} deleted`);
    return result;
  } catch (err) {
    console.error(`[db] deleteProduct: ERROR - Rolling back:`, err.message);
    try {
      exec("ROLLBACK");
    } catch (rollbackErr) {
      console.error(
        `[db] deleteProduct: ROLLBACK failed:`,
        rollbackErr.message,
      );
    }
    throw err;
  }
}
async function updateProduct(id, productData) {
  await getDatabase();

  try {
    // Verify product exists before updating
    const existingProduct = get("SELECT * FROM products WHERE id = ?", [id]);
    if (!existingProduct) {
      throw new Error(`Product ${id} not found`);
    }

    // Start transaction
    exec("BEGIN TRANSACTION");

    const fields = [
      "name",
      "product_type",
      "hsn",
      "manufacturer",
      "min_stock_level",
      "unit",
      "description",
    ];

    const setClause = fields.map((f) => `${f} = ?`).join(", ");

    // ✅ FIXED: for product_type, always use existing DB value as fallback
    // so NOT NULL is never violated even though UI stopped sending it
    const values = fields.map((f) => {
      if (f === "product_type") {
        return (
          productData.product_type || existingProduct.product_type || "general"
        );
      }
      return productData[f] ?? null;
    });

    run(
      `UPDATE products SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id],
    );

    // Handle batch updates with transaction safety
    if (productData.batches && Array.isArray(productData.batches)) {
      const existingBatches = all(
        "SELECT * FROM batches WHERE product_id = ?",
        [id],
      );

      // Track which existing batch IDs are still present
      const incomingIds = new Set(
        productData.batches.filter((b) => b.id).map((b) => b.id),
      );

      for (let i = 0; i < productData.batches.length; i++) {
        const batch = productData.batches[i];
        const mrp = parseFloat(batch.mrp) || 0;

        if (batch.id) {
          // Update existing batch — matched by id
          run(
            `
        UPDATE batches SET
          mrp          = ?,
          selling_rate = ?,
          cost_price   = 0,
          quantity     = ?,
          expiry_date  = NULL,
          wholesaler_id = ?,
          updated_at   = CURRENT_TIMESTAMP
        WHERE id = ? AND product_id = ?
      `,
            [
              mrp,
              mrp, // selling_rate = MRP, discount applied at billing
              batch.quantity || 0,
              batch.wholesaler_id || null,
              batch.id,
              id,
            ],
          );
        } else {
          // Insert new batch — auto-generate batch_number
          const autoBatchNumber = `AUTO-${id}-${Date.now()}-${i}`;
          run(
            `
        INSERT INTO batches (
          product_id, batch_number, mrp, selling_rate, cost_price,
          quantity, expiry_date, wholesaler_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
            [
              id,
              autoBatchNumber,
              mrp,
              mrp,
              0,
              batch.quantity || 0,
              null,
              batch.wholesaler_id || null,
            ],
          );
        }
      }

      // Delete batches that were removed (not in incoming list)
      for (const existing of existingBatches) {
        if (!incomingIds.has(existing.id)) {
          run("DELETE FROM batches WHERE id = ?", [existing.id]);
        }
      }
    }

    exec("COMMIT");

    console.log(`[db] updateProduct: SUCCESS - Product ${id} updated`);
    return getProductById(id);
  } catch (err) {
    console.error(`[db] updateProduct: ERROR - Rolling back:`, err.message);
    try {
      exec("ROLLBACK");
    } catch (rollbackErr) {
      console.error(
        `[db] updateProduct: ROLLBACK failed:`,
        rollbackErr.message,
      );
    }
    throw err;
  }
}
// Wholesaler functions
async function addWholesaler(wholesalerData) {
  await getDatabase();
  try {
    const res = run(
      "INSERT INTO wholesalers (name, contactNumber, gstNumber) VALUES (?, ?, ?)",
      [
        wholesalerData.name,
        wholesalerData.contactNumber || null,
        wholesalerData.gstNumber || null,
      ],
    );
    return { id: res.lastID, ...wholesalerData };
  } catch (err) {
    // Rethrow for caller to handle
    throw err;
  }
}

async function getWholesalers() {
  await getDatabase();
  return all("SELECT * FROM wholesalers ORDER BY name ASC");
}

async function getWholesalerById(id) {
  await getDatabase();
  return get("SELECT * FROM wholesalers WHERE id = ?", [id]);
}

async function updateWholesaler(id, wholesalerData) {
  await getDatabase();
  run(
    "UPDATE wholesalers SET name = ?, contactNumber = ?, gstNumber = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [
      wholesalerData.name,
      wholesalerData.contactNumber || null,
      wholesalerData.gstNumber || null,
      id,
    ],
  );
  return getWholesalerById(id);
}

async function deleteWholesaler(id) {
  await getDatabase();
  run("DELETE FROM wholesalers WHERE id = ?", [id]);
}

// Shop Settings functions
async function getSettings() {
  await getDatabase();
  // Always return the first row (single shop config model)
  const row = get("SELECT * FROM shop_settings LIMIT 1", []);
  if (!row) {
    // Return default empty object if no row exists
    return {
      shop_name: "",
      owner_name: "",
      phone: "",
      address: "",
      gst_number: "",
    };
  }
  return row;
}

async function saveSettings(settingsData) {
  await getDatabase();
  // Check if a row already exists
  const existing = get("SELECT id FROM shop_settings LIMIT 1", []);

  if (existing) {
    // Update existing row
    run(
      `
      UPDATE shop_settings 
      SET shop_name = ?, owner_name = ?, phone = ?, address = ?, gst_number = ?, 
          bank_holder = ?, bank_name = ?, bank_account = ?, bank_ifsc = ?, bank_qr_path = ?, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [
        settingsData.shop_name || "",
        settingsData.owner_name || "",
        settingsData.phone || "",
        settingsData.address || "",
        settingsData.gst_number || "",
        settingsData.bank_holder || "",
        settingsData.bank_name || "",
        settingsData.bank_account || "",
        settingsData.bank_ifsc || "",
        settingsData.bank_qr_path || "",
        existing.id,
      ],
    );
    return getSettings();
  } else {
    // Insert new row
    const res = run(
      `
      INSERT INTO shop_settings (shop_name, owner_name, phone, address, gst_number, bank_holder, bank_name, bank_account, bank_ifsc, bank_qr_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        settingsData.shop_name || "",
        settingsData.owner_name || "",
        settingsData.phone || "",
        settingsData.address || "",
        settingsData.gst_number || "",
        settingsData.bank_holder || "",
        settingsData.bank_name || "",
        settingsData.bank_account || "",
        settingsData.bank_ifsc || "",
        settingsData.bank_qr_path || "",
      ],
    );
    return getSettings();
  }
}

// Product Type functions
async function addProductType(typeData) {
  await getDatabase();
  try {
    const res = run(
      "INSERT INTO product_types (id, label, is_default) VALUES (?, ?, ?)",
      [
        typeData.name || typeData.id,
        typeData.label,
        0, // custom types are never defaults
      ],
    );
    return {
      id: typeData.name || typeData.id,
      label: typeData.label,
      is_default: false,
    };
  } catch (err) {
    throw err;
  }
}

async function getProductTypes() {
  await getDatabase();
  return all(
    "SELECT * FROM product_types ORDER BY is_default DESC, id ASC",
    [],
  );
}

async function deleteProductType(typeId) {
  await getDatabase();
  // Never allow deleting defaults (check in frontend too)
  const type = get("SELECT * FROM product_types WHERE id = ?", [typeId]);
  if (type && type.is_default) {
    throw new Error("Cannot delete default product types");
  }
  run("DELETE FROM product_types WHERE id = ?", [typeId]);
}

// HSN Code functions
async function addHSNCode(hsnData) {
  await getDatabase();
  try {
    const res = run(
      "INSERT INTO hsn_codes (hsn_code, description, gst_rate, is_active) VALUES (?, ?, ?, ?)",
      [
        hsnData.hsn_code,
        hsnData.description || "",
        hsnData.gst_rate,
        hsnData.is_active !== undefined ? (hsnData.is_active ? 1 : 0) : 1,
      ],
    );
    return {
      hsn_code: hsnData.hsn_code,
      description: hsnData.description || "",
      gst_rate: hsnData.gst_rate,
      is_active: true,
    };
  } catch (err) {
    throw err;
  }
}

async function getHSNCodes() {
  await getDatabase();
  const rows = all("SELECT * FROM hsn_codes ORDER BY hsn_code ASC", []);
  // Convert is_active from 0/1 to boolean
  return rows.map((row) => ({ ...row, is_active: row.is_active === 1 }));
}

async function updateHSNCode(hsnCode, hsnData) {
  await getDatabase();
  const is_active =
    hsnData.is_active !== undefined ? (hsnData.is_active ? 1 : 0) : 1;
  run(
    "UPDATE hsn_codes SET description = ?, gst_rate = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE hsn_code = ?",
    [hsnData.description || "", hsnData.gst_rate, is_active, hsnCode],
  );
  const updated = get("SELECT * FROM hsn_codes WHERE hsn_code = ?", [hsnCode]);
  return { ...updated, is_active: updated.is_active === 1 };
}

async function deleteHSNCode(hsnCode) {
  await getDatabase();
  run("DELETE FROM hsn_codes WHERE hsn_code = ?", [hsnCode]);
}

// ═════════════════════════════════════════════════════════════════
// Invoice functions
// ═════════════════════════════════════════════════════════════════

// Helper: Get financial year (April to March)
function getFinancialYear() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1 = Jan, 12 = Dec
  const year = now.getFullYear();
  if (month >= 4) {
    // April or later → current financial year
    return `${year}-${String(year + 1).slice(-2)}`;
  } else {
    // Jan to March → previous financial year
    return `${year - 1}-${String(year).slice(-2)}`;
  }
}

// Generate next invoice number using better-sqlite3 direct access
function getNextInvoiceNumber() {
  getDatabase();

  const fy = getFinancialYear();
  const prefix = `OE/${fy}/`;

  // Use the internal module-level get() function
  const lastInvoice = get(
    `SELECT invoice_number FROM invoices
     WHERE invoice_number LIKE ?
     ORDER BY id DESC
     LIMIT 1`,
    [`${prefix}%`],
  );

  let nextNumber = 1;
  if (lastInvoice && lastInvoice.invoice_number) {
    const parts = lastInvoice.invoice_number.split("/");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextNumber = lastNum + 1;
    }
  }

  const padded = String(nextNumber).padStart(3, "0");
  return `${prefix}${padded}`;
}

function createInvoice(invoiceData) {
  getDatabase();

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

      // subtotal = qty × selling_rate
      // selling_rate is already post-discount (MRP × (1 - disc/100))
      // DO NOT apply discount again
      const subtotal = quantity * sellingRate;

      // batch stock check stays unchanged...
      const batch = get(
        "SELECT * FROM batches WHERE product_id = ? AND batch_number = ?",
        [item.product_id, item.batch_number],
      );

      if (!batch) {
        throw new Error(
          `Batch ${item.batch_number} not found for product ${item.product_id}`,
        );
      }

      if (batch.quantity < quantity) {
        throw new Error(
          `Insufficient stock: ${item.batch_number} has only ${batch.quantity} units, requested ${quantity}`,
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

      totalAmount += subtotal;
    }

    // taxableAmount = totalAmount directly — no discount applied again
    const taxableAmount = totalAmount;

    // Calculate GST on taxableAmount per item
    // selling_rate is already post-discount so full subtotal is taxable
    let totalGST = 0;
    itemsWithSubtotals.forEach((item) => {
      totalGST += (item.subtotal * item.gstPercent) / 100;
    });

    const finalTotal = taxableAmount + totalGST;
    const invoiceDiscountPercent = invoiceData.discount_percent || 0;

    // Insert invoice
    const invoiceRes = run(
      `INSERT INTO invoices (
        customer_name, customer_phone, customer_address,
        bill_to_gstin, bill_to_state,
        ship_same_as_bill, ship_to_name, ship_to_address, ship_to_gstin, ship_to_state,
        place_of_supply, eway_bill_no, invoice_number,
        notes, discount_percent, tax_type, total_amount, customer_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceData.customer_name, // 1
        invoiceData.customer_phone || "", // 2
        invoiceData.customer_address || "", // 3
        invoiceData.bill_to_gstin || "", // 4
        invoiceData.bill_to_state || "", // 5
        invoiceData.ship_same_as_bill ? 1 : 0, // 6
        invoiceData.ship_to_name || "", // 7
        invoiceData.ship_to_address || "", // 8
        invoiceData.ship_to_gstin || "", // 9
        invoiceData.ship_to_state || "", // 10
        invoiceData.place_of_supply || "", // 11
        invoiceData.eway_bill_no || "", // 12
        invoiceData.invoice_number || null, // 13
        invoiceData.notes || "", // 14
        invoiceDiscountPercent, // 15
        invoiceData.tax_type || "gst", // 16
        finalTotal, // 17
        invoiceData.customer_id || null, // 18
      ],
    );

    const invoiceId = invoiceRes.lastID;

    // Insert items and deduct stock from batches
    const savedItems = [];
    for (const item of itemsWithSubtotals) {
      // Get product name to store with item
      const product = get("SELECT name FROM products WHERE id = ?", [
        item.product_id,
      ]);
      const productName = product ? String(product.name).trim() : ""; // Ensure it's a non-empty string, never "0"

      // Use expiry_date from form if provided, otherwise fetch from batch
      let expiryDate = item.expiry_date || null;
      if (!expiryDate) {
        const batch = get(
          "SELECT expiry_date FROM batches WHERE product_id = ? AND batch_number = ?",
          [item.product_id, item.batch_number],
        );
        expiryDate = batch ? batch.expiry_date : null;
      }

      console.log(
        `[db] createInvoice: Adding item - Product: "${productName}", HSN: "${item.hsn_code}", Expiry: "${expiryDate}"`,
      );

      const itemRes = run(
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
          item.return_reason || "",
          item.subtotal,
          expiryDate || null,
        ],
      );

      // Deduct stock from batch
      run(
        "UPDATE batches SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND batch_number = ?",
        [item.quantity, item.product_id, item.batch_number],
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

function getInvoices() {
  getDatabase();
  const invoices = all("SELECT * FROM invoices ORDER BY created_at DESC", []);

  const result = [];
  for (const inv of invoices) {
    const items = all(
      `SELECT ii.*, p.unit
       FROM invoice_items ii
       LEFT JOIN products p ON ii.product_id = p.id
       WHERE ii.invoice_id = ?`,
      [inv.id],
    );
    result.push({ ...inv, items });
  }
  return result;
}

function getInvoiceById(id) {
  getDatabase();
  const invoice = get("SELECT * FROM invoices WHERE id = ?", [id]);
  if (!invoice) return null;

  const items = all(
    `SELECT ii.*, p.unit
     FROM invoice_items ii
     LEFT JOIN products p ON ii.product_id = p.id
     WHERE ii.invoice_id = ?`,
    [id],
  );

  return { ...invoice, items };
}

function deleteInvoice(id) {
  getDatabase();

  // Get invoice with items to restore stock
  const invoice = getInvoiceById(id);
  if (!invoice) {
    throw new Error(`Invoice ${id} not found`);
  }

  // Restore stock for all items
  for (const item of invoice.items) {
    run(
      "UPDATE batches SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND batch_number = ?",
      [item.quantity, item.product_id, item.batch_number],
    );
  }

  // Delete invoice items
  run("DELETE FROM invoice_items WHERE invoice_id = ?", [id]);

  // Delete invoice
  run("DELETE FROM invoices WHERE id = ?", [id]);
}

function updateInvoice(id, invoiceData) {
  getDatabase();

  // ── Step 1: Load the existing invoice to restore stock ──
  const existingInvoice = getInvoiceById(id);
  if (!existingInvoice) {
    throw new Error(`Invoice ${id} not found`);
  }

  try {
    exec("BEGIN TRANSACTION");

    // ── Step 2: Restore stock for ALL old items ──
    for (const oldItem of existingInvoice.items) {
      if (!oldItem.product_id || !oldItem.batch_number) continue;

      try {
        run(
          `UPDATE batches 
           SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP 
           WHERE product_id = ? AND batch_number = ?`,
          [oldItem.quantity, oldItem.product_id, oldItem.batch_number],
        );
        console.log(
          `[db] updateInvoice: Restored ${oldItem.quantity} units to batch ${oldItem.batch_number}`,
        );
      } catch (restoreErr) {
        console.warn(
          `[db] updateInvoice: Could not restore stock for batch ${oldItem.batch_number}:`,
          restoreErr.message,
        );
      }
    }

    // ── Step 3: Delete all old invoice_items ──
    run("DELETE FROM invoice_items WHERE invoice_id = ?", [id]);

    // ── Step 4: Recalculate totals from new items ──
    const items = invoiceData.items || [];
    let totalAmount = 0;
    const processedItems = [];

    for (const item of items) {
      const quantity = parseInt(item.quantity) || 0;
      const sellingRate = parseFloat(item.selling_rate) || 0;
      const discountPct = parseFloat(item.discount_percent) || 0;
      const gstPct = parseFloat(item.gst_percent) || 0;
      const subtotal = quantity * sellingRate;

      // ── Validate stock ──
      if (item.product_id && item.batch_number) {
        const batch = get(
          "SELECT * FROM batches WHERE product_id = ? AND batch_number = ?",
          [item.product_id, item.batch_number],
        );
        if (!batch) {
          throw new Error(
            `Batch "${item.batch_number}" not found for product ${item.product_id}`,
          );
        }
        if (batch.quantity < quantity) {
          throw new Error(
            `Insufficient stock: batch "${item.batch_number}" has ${batch.quantity} units, ` +
              `but ${quantity} requested`,
          );
        }
      }

      totalAmount += subtotal;

      processedItems.push({
        ...item,
        quantity,
        sellingRate,
        discountPct,
        gstPct,
        subtotal,
      });
    }

    // Calculate GST on taxable amount (matching createInvoice logic)
    let totalGST = 0;
    processedItems.forEach((item) => {
      totalGST += (item.subtotal * item.gstPct) / 100;
    });

    const finalTotal = totalAmount + totalGST;

    // ── Step 6: Update invoice row ──
    run(
      `UPDATE invoices SET
        customer_name     = ?,
        customer_phone    = ?,
        customer_address  = ?,
        bill_to_name      = ?,
        bill_to_phone     = ?,
        bill_to_gstin     = ?,
        bill_to_state     = ?,
        ship_same_as_bill = ?,
        ship_to_name      = ?,
        ship_to_phone     = ?,
        ship_to_address   = ?,
        ship_to_gstin     = ?,
        ship_to_state     = ?,
        place_of_supply   = ?,
        eway_bill_no      = ?,
        invoice_number    = ?,
        notes             = ?,
        discount_percent  = ?,
        tax_type          = ?,
        total_amount      = ?,
        customer_id       = ?,
        updated_at        = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        invoiceData.customer_name || "",
        invoiceData.customer_phone || "",
        invoiceData.customer_address || "",
        invoiceData.bill_to_name || "",
        invoiceData.bill_to_phone || "",
        invoiceData.bill_to_gstin || "",
        invoiceData.bill_to_state || "",
        invoiceData.ship_same_as_bill ? 1 : 0,
        invoiceData.ship_to_name || "",
        invoiceData.ship_to_phone || "",
        invoiceData.ship_to_address || "",
        invoiceData.ship_to_gstin || "",
        invoiceData.ship_to_state || "",
        invoiceData.place_of_supply || "",
        invoiceData.eway_bill_no || "",
        invoiceData.invoice_number || existingInvoice.invoice_number || "",
        invoiceData.notes || "",
        parseFloat(invoiceData.discount_percent) || 0,
        invoiceData.tax_type || "gst",
        invoiceData.total_amount || finalTotal,
        invoiceData.customer_id || null,
        id,
      ],
    );

    // ── Step 7: Insert new items + deduct stock ──
    for (const item of processedItems) {
      // Get product name fresh from DB (same as createInvoice)
      let productName = item.product_name || "";
      if (item.product_id) {
        const product = get("SELECT name FROM products WHERE id = ?", [
          item.product_id,
        ]);
        if (product) productName = String(product.name).trim();
      }

      // Get expiry_date from batch if not provided
      let expiryDate = item.expiry_date || null;
      if (!expiryDate && item.product_id && item.batch_number) {
        const batch = get(
          "SELECT expiry_date FROM batches WHERE product_id = ? AND batch_number = ?",
          [item.product_id, item.batch_number],
        );
        if (batch) expiryDate = batch.expiry_date || null;
      }

      run(
        `INSERT INTO invoice_items (
          invoice_id, product_id, product_name, batch_number,
          quantity, original_selling_rate, selling_rate, mrp,
          hsn_code, discount_percent, gst_percent,
          is_return, return_reason, subtotal, expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.product_id || null,
          productName,
          item.batch_number || null,
          item.quantity,
          item.original_selling_rate || item.sellingRate,
          item.sellingRate,
          item.mrp || null,
          item.hsn_code || null,
          item.discountPct,
          item.gstPct,
          item.is_return ? 1 : 0,
          item.return_reason || null,
          item.subtotal,
          expiryDate,
        ],
      );

      // ── Deduct stock from batch ──
      if (item.product_id && item.batch_number) {
        run(
          `UPDATE batches 
           SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP 
           WHERE product_id = ? AND batch_number = ?`,
          [item.quantity, item.product_id, item.batch_number],
        );
        console.log(
          `[db] updateInvoice: Deducted ${item.quantity} from batch ${item.batch_number}`,
        );
      }
    }

    exec("COMMIT");
    console.log(`[db] updateInvoice: SUCCESS — Invoice ${id} fully updated`);

    // Return fresh complete invoice
    return getInvoiceById(id);
  } catch (err) {
    console.error(`[db] updateInvoice: ERROR — Rolling back:`, err.message);
    try {
      exec("ROLLBACK");
    } catch (rbErr) {
      console.error(`[db] updateInvoice: ROLLBACK failed:`, rbErr.message);
    }
    throw err;
  }
}

// ========== CUSTOMER MANAGEMENT FUNCTIONS ==========

function getAllCustomers() {
  getDatabase();
  try {
    const customers = all(
      "SELECT * FROM customers ORDER BY customer_name ASC",
      [],
    );
    return customers || [];
  } catch (err) {
    console.error("[db] getAllCustomers error:", err);
    throw err;
  }
}

function getCustomerById(customerId) {
  getDatabase();
  try {
    const customer = get("SELECT * FROM customers WHERE id = ?", [customerId]);
    return customer || null;
  } catch (err) {
    console.error("[db] getCustomerById error:", err);
    throw err;
  }
}

function searchCustomers(searchTerm) {
  getDatabase();
  try {
    const term = `%${searchTerm}%`;
    const customers = all(
      "SELECT * FROM customers WHERE customer_name LIKE ? OR phone_number LIKE ? ORDER BY customer_name ASC",
      [term, term],
    );
    return customers || [];
  } catch (err) {
    console.error("[db] searchCustomers error:", err);
    throw err;
  }
}

function saveOrUpdateCustomer(customerData) {
  getDatabase();
  try {
    const {
      customer_name,
      phone_number,
      bill_to_address,
      bill_to_gstin,
      bill_to_state,
      ship_to_name,
      ship_to_address,
      ship_to_gstin,
      ship_to_state,
      discount,
    } = customerData;

    // Check if customer with same name and phone already exists
    const existing = get(
      "SELECT id FROM customers WHERE customer_name = ? AND phone_number = ?",
      [customer_name, phone_number],
    );

    if (existing) {
      // Update existing customer
      run(
        `UPDATE customers SET 
          bill_to_address = ?, bill_to_gstin = ?, bill_to_state = ?,
          ship_to_name = ?, ship_to_address = ?, ship_to_gstin = ?, ship_to_state = ?,
          discount = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [
          bill_to_address || null,
          bill_to_gstin || null,
          bill_to_state || null,
          ship_to_name || null,
          ship_to_address || null,
          ship_to_gstin || null,
          ship_to_state || null,
          parseFloat(discount) || 0,
          existing.id,
        ],
      );
      return getCustomerById(existing.id);
    } else {
      // Insert new customer
      const res = run(
        `INSERT INTO customers (
          customer_name, phone_number,
          bill_to_address, bill_to_gstin, bill_to_state,
          ship_to_name, ship_to_address, ship_to_gstin, ship_to_state,
          discount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customer_name,
          phone_number || null,
          bill_to_address || null,
          bill_to_gstin || null,
          bill_to_state || null,
          ship_to_name || null,
          ship_to_address || null,
          ship_to_gstin || null,
          ship_to_state || null,
          parseFloat(discount) || 0,
        ],
      );
      return getCustomerById(res.lastID);
    }
  } catch (err) {
    console.error("[db] saveOrUpdateCustomer error:", err);
    throw err;
  }
}

function updateCustomer(customerId, customerData) {
  getDatabase();
  try {
    const {
      customer_name,
      phone_number,
      bill_to_address,
      bill_to_gstin,
      bill_to_state,
      ship_to_name,
      ship_to_address,
      ship_to_gstin,
      ship_to_state,
      discount,
    } = customerData;

    run(
      `UPDATE customers SET 
        customer_name = ?, phone_number = ?,
        bill_to_address = ?, bill_to_gstin = ?, bill_to_state = ?,
        ship_to_name = ?, ship_to_address = ?, ship_to_gstin = ?, ship_to_state = ?,
        discount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        customer_name,
        phone_number || null,
        bill_to_address || null,
        bill_to_gstin || null,
        bill_to_state || null,
        ship_to_name || null,
        ship_to_address || null,
        ship_to_gstin || null,
        ship_to_state || null,
        parseFloat(discount) || 0,
        customerId,
      ],
    );
    return getCustomerById(customerId);
  } catch (err) {
    console.error("[db] updateCustomer error:", err);
    throw err;
  }
}

// ========== DASHBOARD AGGREGATION FUNCTIONS ==========

function getDashboardSummary() {
  getDatabase();
  try {
    // Total products count
    const productsCount = get("SELECT COUNT(*) as count FROM products");
    const totalProducts = productsCount?.count || 0;

    // Recent invoices count
    const invoicesCount = get("SELECT COUNT(*) as count FROM invoices");
    const recentInvoices = invoicesCount?.count || 0;

    return {
      success: true,
      data: {
        totalProducts: totalProducts,
        recentInvoices: recentInvoices,
      },
    };
  } catch (error) {
    console.error("[db] getDashboardSummary error:", error);
    throw error;
  }
}

function getLowStockItems() {
  getDatabase();
  try {
    // Query products with low stock
    const query = `
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.min_stock_level,
        COALESCE(SUM(b.quantity), 0) as current_stock
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      GROUP BY p.id, p.name, p.min_stock_level
      HAVING current_stock <= p.min_stock_level
      ORDER BY (p.min_stock_level - current_stock) DESC
    `;

    const lowStockProducts = all(query);

    // Build response with severity levels
    const items = lowStockProducts.map((item) => {
      const unitsBelow = item.min_stock_level - item.current_stock;
      const severity =
        unitsBelow > item.min_stock_level * 0.5 ? "critical" : "warning";

      return {
        product_id: item.product_id,
        product_name: item.product_name,
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
    console.error("[db] getLowStockItems error:", error);
    throw error;
  }
}

// getExpiryOverview - REMOVED (not applicable to electric shop)

function getSalesOverview(period = "month") {
  getDatabase();
  try {
    let query = "";
    let params = [];

    if (period === "year") {
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
      const currentMonth = String(today.getMonth() + 1).padStart(2, "0");
      query = `
        SELECT 
          COALESCE(SUM(total_amount), 0) as total_sales,
          COUNT(*) as bill_count
        FROM invoices
        WHERE strftime('%Y-%m', created_at) = ?
      `;
      params = [`${currentYear}-${currentMonth}`];
    }

    const result = get(query, params);

    return {
      success: true,
      data: {
        total_sales: result?.total_sales || 0,
        total_paid: 0, // TODO: Track payments separately if needed
        total_due: 0, // TODO: Track due amounts separately if needed
        bill_count: result?.bill_count || 0,
      },
    };
  } catch (error) {
    console.error("[db] getSalesOverview error:", error);
    throw error;
  }
}

function getPurchaseOverview(period = "month") {
  getDatabase();
  try {
    let query = "";
    let params = [];

    if (period === "year") {
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
      const currentMonth = String(today.getMonth() + 1).padStart(2, "0");
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

    const result = get(query, params);

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
    console.error("[db] getPurchaseOverview error:", error);
    throw error;
  }
}

// ========== PURCHASE BILL CRUD FUNCTIONS ==========

function createPurchaseBill(billData) {
  getDatabase();

  try {
    // Parse and validate numeric values
    const total_amount = parseFloat(billData.total_amount) || 0;
    const amount_paid = parseFloat(billData.amount_paid) || 0;
    const amount_due = total_amount - amount_paid;

    // Handle wholesaler: look up by name or create if doesn't exist
    let wholesaler_id = billData.wholesaler_id;

    if (!wholesaler_id && billData.wholesaler_name) {
      // Try to find existing wholesaler by name
      const existing = get("SELECT id FROM wholesalers WHERE name = ?", [
        billData.wholesaler_name,
      ]);

      if (existing) {
        wholesaler_id = existing.id;
      } else {
        // Create new wholesaler if it doesn't exist
        const result = run(
          "INSERT INTO wholesalers (name, contactNumber, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
          [billData.wholesaler_name, billData.contact_number || null],
        );
        wholesaler_id = result.lastID;
      }
    }

    if (!wholesaler_id) {
      throw new Error("Wholesaler ID or name is required");
    }

    // Insert purchase bill
    const result = run(
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
        amount_paid >= total_amount
          ? "paid"
          : amount_paid > 0
            ? "partial"
            : "unpaid",
        billData.notes || null,
      ],
    );

    // Fetch the created bill with wholesaler info
    const bill = get(
      `SELECT 
        pb.id, pb.bill_number, pb.purchase_date, pb.total_amount, 
        pb.amount_paid, pb.amount_due, pb.payment_status, pb.notes,
        w.name as wholesaler_name, w.contactNumber as wholesaler_contact
      FROM purchase_bills pb
      LEFT JOIN wholesalers w ON pb.wholesaler_id = w.id
      WHERE pb.id = ?`,
      [result.lastID],
    );

    // Ensure all numeric fields are properly converted
    return {
      id: bill.id,
      bill_number: bill.bill_number || "",
      purchase_date: bill.purchase_date || "",
      wholesaler_name: bill.wholesaler_name || "",
      wholesaler_contact: bill.wholesaler_contact || "",
      total_amount: parseFloat(bill.total_amount) || 0,
      amount_paid: parseFloat(bill.amount_paid) || 0,
      amount_due: parseFloat(bill.amount_due) || 0,
      payment_status: bill.payment_status || "unpaid",
      notes: bill.notes || "",
    };
  } catch (error) {
    console.error("[db] createPurchaseBill error:", error);
    throw error;
  }
}

function getPurchaseBills() {
  getDatabase();

  try {
    const bills = all(
      `SELECT 
        pb.id, pb.bill_number, pb.purchase_date, pb.total_amount, 
        pb.amount_paid, pb.amount_due, pb.payment_status, pb.notes,
        w.name as wholesaler_name, w.contactNumber as wholesaler_contact
      FROM purchase_bills pb
      LEFT JOIN wholesalers w ON pb.wholesaler_id = w.id
      ORDER BY pb.created_at DESC`,
    );

    // Ensure all numeric fields are properly converted
    return (bills || []).map((bill) => ({
      id: bill.id,
      bill_number: bill.bill_number || "",
      purchase_date: bill.purchase_date || "",
      wholesaler_name: bill.wholesaler_name || "",
      wholesaler_contact: bill.wholesaler_contact || "",
      total_amount: parseFloat(bill.total_amount) || 0,
      amount_paid: parseFloat(bill.amount_paid) || 0,
      amount_due: parseFloat(bill.amount_due) || 0,
      payment_status: bill.payment_status || "unpaid",
      notes: bill.notes || "",
    }));
  } catch (error) {
    console.error("[db] getPurchaseBills error:", error);
    throw error;
  }
}

function updatePurchaseBill(id, billData) {
  getDatabase();

  try {
    // Verify bill exists
    const existingBill = get("SELECT id FROM purchase_bills WHERE id = ?", [
      id,
    ]);
    if (!existingBill) {
      throw new Error(`Purchase bill ${id} not found`);
    }

    // Parse numeric values
    const amount_paid = parseFloat(billData.amount_paid);

    // Fetch current total_amount to calculate amount_due
    const current = get(
      "SELECT total_amount FROM purchase_bills WHERE id = ?",
      [id],
    );
    const total_amount = parseFloat(current.total_amount) || 0;
    const amount_due = total_amount - amount_paid;
    const payment_status =
      amount_paid >= total_amount
        ? "paid"
        : amount_paid > 0
          ? "partial"
          : "unpaid";

    // Update purchase bill
    run(
      `UPDATE purchase_bills SET 
        amount_paid = ?, amount_due = ?, payment_status = ?,
        notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [amount_paid, amount_due, payment_status, billData.notes || null, id],
    );

    // Fetch and return updated bill with wholesaler info
    const bill = get(
      `SELECT 
        pb.id, pb.bill_number, pb.purchase_date, pb.total_amount, 
        pb.amount_paid, pb.amount_due, pb.payment_status, pb.notes,
        w.name as wholesaler_name, w.contactNumber as wholesaler_contact
      FROM purchase_bills pb
      LEFT JOIN wholesalers w ON pb.wholesaler_id = w.id
      WHERE pb.id = ?`,
      [id],
    );

    // Ensure all numeric fields are properly converted
    return {
      id: bill.id,
      bill_number: bill.bill_number || "",
      purchase_date: bill.purchase_date || "",
      wholesaler_name: bill.wholesaler_name || "",
      wholesaler_contact: bill.wholesaler_contact || "",
      total_amount: parseFloat(bill.total_amount) || 0,
      amount_paid: parseFloat(bill.amount_paid) || 0,
      amount_due: parseFloat(bill.amount_due) || 0,
      payment_status: bill.payment_status || "unpaid",
      notes: bill.notes || "",
    };
  } catch (error) {
    console.error("[db] updatePurchaseBill error:", error);
    throw error;
  }
}

function deletePurchaseBill(id) {
  getDatabase();

  try {
    // Verify bill exists
    const bill = get("SELECT id FROM purchase_bills WHERE id = ?", [id]);
    if (!bill) {
      throw new Error(`Purchase bill ${id} not found`);
    }

    // Delete the purchase bill
    run("DELETE FROM purchase_bills WHERE id = ?", [id]);

    // Verify deletion
    const deleted = get("SELECT id FROM purchase_bills WHERE id = ?", [id]);
    if (deleted) {
      throw new Error(`Failed to delete purchase bill ${id}`);
    }

    return { success: true, id };
  } catch (error) {
    console.error("[db] deletePurchaseBill error:", error);
    throw error;
  }
}

function getRecentInvoices(limit = 10) {
  getDatabase();
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

    const invoices = all(query, [limit]);

    return {
      success: true,
      data: {
        invoices: invoices || [],
      },
    };
  } catch (error) {
    console.error("[db] getRecentInvoices error:", error);
    throw error;
  }
}

// Authentication functions
const crypto = require("crypto");

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function ownerExists() {
  getDatabase();
  try {
    const owner = get("SELECT id FROM owners WHERE is_active = 1 LIMIT 1");
    return !!owner;
  } catch (error) {
    console.error("[db] ownerExists error:", error);
    return false;
  }
}

function verifyOwnerByUsername(username) {
  getDatabase();
  try {
    const owner = get(
      "SELECT id, username, email, first_name, last_name FROM owners WHERE (username = ? OR email = ?) AND is_active = 1",
      [username.toLowerCase(), username.toLowerCase()],
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
    console.error("[db] verifyOwnerByUsername error:", error);
    return null;
  }
}

function getOwner() {
  getDatabase();
  try {
    const owner = get("SELECT * FROM owners WHERE is_active = 1 LIMIT 1");
    return owner || null;
  } catch (error) {
    console.error("[db] getOwner error:", error);
    return null;
  }
}

function registerOwner(
  username,
  email,
  password,
  firstName = "",
  lastName = "",
) {
  getDatabase();
  try {
    // Check if owner already exists
    const existing = get("SELECT id FROM owners WHERE is_active = 1 LIMIT 1");
    if (existing) {
      throw new Error("Owner account already exists");
    }

    const passwordHash = hashPassword(password);

    const result = run(
      `INSERT INTO owners (username, email, password_hash, first_name, last_name, is_active) 
       VALUES (?, ?, ?, ?, ?, 1)`,
      [
        username.toLowerCase(),
        email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
      ],
    );

    console.log("[db] Owner registered successfully");

    return {
      id: result.lastID,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      first_name: firstName,
      last_name: lastName,
    };
  } catch (error) {
    console.error("[db] registerOwner error:", error);
    throw error;
  }
}

function loginOwner(username, password) {
  getDatabase();
  try {
    const passwordHash = hashPassword(password);

    const owner = get(
      `SELECT * FROM owners WHERE (username = ? OR email = ?) AND is_active = 1 AND password_hash = ?`,
      [username.toLowerCase(), username.toLowerCase(), passwordHash],
    );

    if (!owner) {
      throw new Error("Invalid credentials");
    }

    console.log("[db] Owner login successful:", owner.username);

    return {
      id: owner.id,
      username: owner.username,
      email: owner.email,
      first_name: owner.first_name,
      last_name: owner.last_name,
    };
  } catch (error) {
    console.error("[db] loginOwner error:", error);
    throw error;
  }
}

// resetPasswordWithRecoveryCode - DISABLED (Admin Recovery Code removed)
// Recovery code functionality has been removed from the system
// async function resetPasswordWithRecoveryCode(username, recoveryCode, newPassword) {
//   Functionality removed - users must use alternative password reset methods
// }

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
  addHSNCode,
  getHSNCodes,
  updateHSNCode,
  deleteHSNCode,
  getNextInvoiceNumber,
  createInvoice,
  getInvoices,
  getInvoiceById,
  deleteInvoice,
  updateInvoice,
  getDashboardSummary,
  getLowStockItems,
  // getExpiryOverview - REMOVED
  getSalesOverview,
  getPurchaseOverview,
  getRecentInvoices,
  createPurchaseBill,
  getPurchaseBills,
  updatePurchaseBill,
  deletePurchaseBill,
  getAllCustomers,
  getCustomerById,
  searchCustomers,
  saveOrUpdateCustomer,
  updateCustomer,
  ownerExists,
  verifyOwnerByUsername,
  getOwner,
  registerOwner,
  loginOwner,
};
