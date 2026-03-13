const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const net = require("net");
// ensure correct resolution both during development (file system) and
// packaged inside app.asar
// compute path to database module in a packaging-friendly way
// during development __dirname points to electron/ folder, in production
// it points inside app.asar. app.getAppPath() returns the asar root path.
function resolveDatabasePath() {
  if (app.isPackaged) {
    // extraResources copies database/ to resources/database/
    // process.resourcesPath points to the resources/ folder
    const candidate = path.join(process.resourcesPath, 'database', 'db');
    console.log('[electron] resolveDatabasePath (packaged) ->', candidate,
                'exists=', fs.existsSync(candidate + '.js'));
    return candidate;
  } else {
    // Development: __dirname is electron/ folder
    const candidate = path.join(__dirname, '..', 'database', 'db');
    console.log('[electron] resolveDatabasePath (dev) ->', candidate,
                'exists=', fs.existsSync(candidate + '.js'));
    return candidate;
  }
}

const dbPath = resolveDatabasePath();
const db = require(dbPath);
const { initializeLicense, activateLicense } = require("./licensing/licenseValidator");

let mainWindow;
let activationWindow;
let licenseValid = false;  // Track if license is validated
let activationComplete = false; // Track if activation process is complete
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Windows: set AppUserModelId for proper shortcuts & notifications
if (process.platform === "win32" && app.setAppUserModelId) {
  app.setAppUserModelId("com.choudharymedical.billing");
}

// Create the browser window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "../unamed.ico"),
  });

  // Load Vite dev server in development
  if (!app.isPackaged) {
    const devUrl = "http://localhost:5173";
    console.log('[electron] Loading dev server:', devUrl);

    // Log preload path existence
    const preloadPath = path.join(__dirname, "preload.js");
    console.log('[electron] preload path:', preloadPath, 'exists=', fs.existsSync(preloadPath));

    // Check TCP connectivity to the dev server port before loading
    const parsed = new URL(devUrl);
    const host = parsed.hostname;
    const port = parseInt(parsed.port, 10) || 80;

    const socket = new net.Socket();
    let connected = false;
    socket.setTimeout(3000);
    socket
      .once('connect', () => {
        connected = true;
        console.log('[electron] TCP connection to', host + ':' + port, 'succeeded');
        socket.destroy();
        mainWindow.loadURL(devUrl).catch(err => console.error('[electron] loadURL error:', err));
        if (!app.isPackaged) {
          mainWindow.webContents.openDevTools();
        }
      })
      .once('timeout', () => {
        console.warn('[electron] TCP connection to', host + ':' + port, 'timed out');
        socket.destroy();
        // Still attempt to load - may fail but will surface did-fail-load
        mainWindow.loadURL(devUrl).catch(err => console.error('[electron] loadURL error:', err));
        if (!app.isPackaged) {
          mainWindow.webContents.openDevTools();
        }
      })
      .once('error', (err) => {
        console.warn('[electron] TCP connection error to', host + ':' + port, err && err.message);
        // Attempt to load anyway to allow error events to be emitted
        mainWindow.loadURL(devUrl).catch(err => console.error('[electron] loadURL error:', err));
        if (!app.isPackaged) {
          mainWindow.webContents.openDevTools();
        }
      })
      .connect({ host, port });
}  else {
      // Frontend is now in extraResources, outside asar
      const prodFile = path.join(process.resourcesPath, 'frontend', 'dist', 'index.html');
      console.log('[electron] prodFile:', prodFile, 'exists:', fs.existsSync(prodFile));
      mainWindow.loadFile(prodFile)
        .then(() => console.log('[electron] loadFile success'))
        .catch(err => console.error('[electron] loadFile error:', err));
  }

  // Prevent external navigation in production
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (app.isPackaged) {
      event.preventDefault();
    }
  });

  // Helpful debug events to trace loading problems
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('[electron] webContents did-start-loading');
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('[electron] webContents dom-ready');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[electron] webContents did-finish-load');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error('[electron] did-fail-load', { errorCode, errorDescription, validatedURL, isMainFrame });
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('[electron] webContents crashed');
  });

  // Prevent new windows / external popups by default
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * Create Activation Window - shown when license is invalid/missing
 * Blocks main app from running until valid license is activated
 */
function createActivationWindow() {
  activationWindow = new BrowserWindow({
    width: 600,
    height: 800,
    minWidth: 500,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    ...(fs.existsSync(path.join(__dirname, "../unamed.ico")) && {
      icon: path.join(__dirname, "../unamed.ico"),
    }),
  });

  // Prevent closing window without valid license
  activationWindow.on("close", (e) => {
    if (!activationComplete) {
      console.log('[license-window] Close attempt blocked');
      e.preventDefault();
    }
  });

  // Load activation page
  if (!app.isPackaged) {
    activationWindow.loadURL('http://localhost:5173/#/activate')
      .catch(err => console.error('[license-window] loadURL error:', err));
  } else {
      // Frontend is now in extraResources, outside asar
      const prodFile = path.join(process.resourcesPath, 'frontend', 'dist', 'index.html');
      console.log('[license-window] prodFile:', prodFile, 'exists:', fs.existsSync(prodFile));
      
      activationWindow.loadFile(prodFile, { hash: 'activate' })
      .then(() => console.log('[license-window] loadFile success'))
      .catch(err => console.error('[license-window] loadFile error:', err));
  }

  activationWindow.on("closed", () => {
    activationWindow = null;
    // If activation window closed without activation, quit app
    console.log('[license-window] Closed - quitting app');
    app.quit();
  });
}

// ═════════════════════════════════════════════════════════════════
// LICENSE MANAGEMENT IPC HANDLERS
// ═════════════════════════════════════════════════════════════════

// IPC: activate-license
ipcMain.handle("activate-license", async (event, licenseKey) => {
  try {
    console.log('[ipc] activate-license handler called');
    
    // Validate license with encryption
    const result = await activateLicense(app, licenseKey);
    
    if (result.success) {
      console.log('[ipc] License activation successful');
      licenseValid = true;
      activationComplete = true; // Allow window to close now

      if (activationWindow) {
        activationWindow.destroy(); // destroy() bypasses close event
      }

      createWindow(); // Create main app window

      return {
        success: true,
        message: 'License activated successfully!',
        expiry: result.expiry
      };
    } else {
      console.error('[ipc] License activation failed:', result.message);
      return {
        success: false,
        message: result.message
      };
    }
    
  } catch (err) {
    console.error('[ipc] License activation error:', err.message);
    return {
      success: false,
      message: err.message || 'Activation failed'
    };
  }
});

// IPC: handle print requests - open native Electron print dialog
// The native dialog includes "Save as PDF" option
ipcMain.handle("print", async (event, options = {}) => {
  try {
    const wc = event.sender;
    
    console.log('[ipc] Print handler called - opening native Electron print dialog');
    
    // Use native Electron print dialog which has "Save as PDF" option built-in
    // This is the most reliable method - user selects "Print to File" or "Save as PDF"
    await wc.print({
      silent: false,  // Show print dialog
      printBackground: true,
      margins: { marginType: 'none' },
      pageSize: 'A4',
      orientation: 'portrait'
    });

    console.log('[ipc] Print dialog completed');
    return {
      success: true,
      message: 'Print dialog opened. Use "Save as PDF" option to save invoice.'
    };

  } catch (err) {
    console.error('[ipc] Print error:', err.message);
    return {
      success: false,
      message: err.message || 'Print failed'
    };
  }
});


// IPC: add-product - insert product with batches into SQLite
ipcMain.handle("add-product", async (event, productData) => {
  try {
    console.log('[ipc] add-product: Received', { name: productData.name, batches: productData.batches?.length });
    const savedProduct = await db.addProduct(productData);
    
    if (!savedProduct || !savedProduct.id || !savedProduct.name) {
      console.error('[ipc] add-product: Invalid product returned:', savedProduct);
      throw new Error('Server returned incomplete product data');
    }
    
    console.log('[ipc] add-product: Success -', { id: savedProduct.id, name: savedProduct.name, batches: savedProduct.batches?.length });
    return { success: true, message: 'Product added successfully', data: savedProduct };
  } catch (err) {
    console.error('[ipc] add-product: ERROR -', err.message);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: get-products - fetch all products with batches from SQLite
ipcMain.handle("get-products", async (event) => {
  try {
    console.log('[ipc] get-products called');
    const products = await db.getProducts();
    console.log('[ipc] get-products returned', products.length, 'products with gst_rate:', products.slice(0, 3).map(p => ({ id: p.id, name: p.name, hsn: p.hsn, gst_rate: p.gst_rate, batchCount: p.batches?.length || 0 })));
    return { success: true, message: '', data: { results: products, count: products.length } };
  } catch (err) {
    console.error('[ipc] get-products error:', err);
    return { success: false, message: err.message, data: { results: [], count: 0 } };
  }
});

// IPC: search-products - search products by name, generic_name, salt_composition
ipcMain.handle("search-products", async (event, query) => {
  try {
    console.log('[ipc] search-products called with query:', query);
    const results = await db.searchProducts(query);
    console.log('[ipc] search-products returned', results.length, 'results');
    return { success: true, message: '', data: { results: results || [] } };
  } catch (err) {
    console.error('[ipc] search-products error:', err);
    return { success: false, message: err.message, data: { results: [] } };
  }
});

// IPC: update-product - update product and batches in SQLite
ipcMain.handle("update-product", async (event, productId, productData) => {
  try {
    console.log('[ipc] update-product called with id:', productId);
    const updatedProduct = await db.updateProduct(productId, productData);
    if (!updatedProduct || !updatedProduct.id) {
      console.error('[ipc] update-product: Incomplete product returned');
      throw new Error('Incomplete product data');
    }
    console.log('[ipc] update-product success');
    return { success: true, message: '', data: updatedProduct };
  } catch (err) {
    console.error('[ipc] update-product ERROR:', err.message);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: delete-product - delete product and related batches from SQLite
ipcMain.handle("delete-product", async (event, productId) => {
  try {
    console.log('[ipc] delete-product called with id:', productId);
    
    // Verify product exists before deletion
    const product = await db.getProductById(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }
    
    // Delete product (also deletes related batches due to transaction)
    await db.deleteProduct(productId);
    
    // Verify product was deleted
    const deletedProduct = await db.getProductById(productId);
    if (deletedProduct) {
      throw new Error(`Failed to delete product ${productId}`);
    }
    
    console.log('[ipc] delete-product successfully deleted id:', productId);
    return { 
      success: true, 
      message: `Product ${productId} deleted successfully`, 
      data: { productId, success: true } 
    };
  } catch (err) {
    console.error('[ipc] delete-product error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: add-wholesaler - insert wholesaler into SQLite
ipcMain.handle("add-wholesaler", async (event, wholesalerData) => {
  try {
    console.log('[ipc] add-wholesaler called with:', wholesalerData);
    const savedWholesaler = await db.addWholesaler(wholesalerData);
    console.log('[ipc] add-wholesaler saved:', savedWholesaler);
    return { success: true, message: '', data: savedWholesaler };
  } catch (err) {
    console.error('[ipc] add-wholesaler error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: get-wholesalers - fetch all wholesalers from SQLite
ipcMain.handle("get-wholesalers", async (event) => {
  try {
    console.log('[ipc] get-wholesalers called');
    const wholesalers = await db.getWholesalers();
    console.log('[ipc] get-wholesalers returned', wholesalers.length, 'wholesalers');
    return { success: true, message: '', data: { results: wholesalers, count: wholesalers.length } };
  } catch (err) {
    console.error('[ipc] get-wholesalers error:', err);
    return { success: false, message: err.message, data: { results: [], count: 0 } };
  }
});

// IPC: update-wholesaler - update wholesaler in SQLite
ipcMain.handle("update-wholesaler", async (event, id, wholesalerData) => {
  try {
    console.log('[ipc] update-wholesaler called with id:', id, 'data:', wholesalerData);
    const updatedWholesaler = await db.updateWholesaler(id, wholesalerData);
    console.log('[ipc] update-wholesaler updated:', updatedWholesaler);
    return { success: true, message: '', data: updatedWholesaler };
  } catch (err) {
    console.error('[ipc] update-wholesaler error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: delete-wholesaler - delete wholesaler from SQLite
ipcMain.handle("delete-wholesaler", async (event, id) => {
  try {
    console.log('[ipc] delete-wholesaler called with id:', id);
    await db.deleteWholesaler(id);
    console.log('[ipc] delete-wholesaler deleted id:', id);
    return { success: true, message: '', data: { success: true } };
  } catch (err) {
    console.error('[ipc] delete-wholesaler error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: get-settings - fetch shop settings from SQLite
ipcMain.handle("get-settings", async (event) => {
  try {
    console.log('[ipc] get-settings called');
    const settings = await db.getSettings();
    console.log('[ipc] get-settings returned:', settings);
    return { success: true, message: '', data: settings };
  } catch (err) {
    console.error('[ipc] get-settings error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: save-settings - insert or update shop settings in SQLite
ipcMain.handle("save-settings", async (event, settingsData) => {
  try {
    console.log('[ipc] save-settings called with:', settingsData);
    const saved = await db.saveSettings(settingsData);
    console.log('[ipc] save-settings saved:', saved);
    return { success: true, message: '', data: saved };
  } catch (err) {
    console.error('[ipc] save-settings error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: add-product-type - add a custom product type
ipcMain.handle("add-product-type", async (event, typeData) => {
  try {
    console.log('[ipc] add-product-type called with:', typeData);
    const newType = await db.addProductType(typeData);
    console.log('[ipc] add-product-type saved:', newType);
    return { success: true, message: '', data: newType };
  } catch (err) {
    console.error('[ipc] add-product-type error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: get-product-types - fetch all product types
ipcMain.handle("get-product-types", async (event) => {
  try {
    console.log('[ipc] get-product-types called');
    const types = await db.getProductTypes();
    console.log('[ipc] get-product-types returned', types.length, 'types');
    return { success: true, message: '', data: types };
  } catch (err) {
    console.error('[ipc] get-product-types error:', err);
    return { success: false, message: err.message, data: [] };
  }
});

// IPC: delete-product-type - delete a custom product type
ipcMain.handle("delete-product-type", async (event, typeId) => {
  try {
    console.log('[ipc] delete-product-type called with id:', typeId);
    await db.deleteProductType(typeId);
    console.log('[ipc] delete-product-type deleted id:', typeId);
    return { success: true, message: '', data: { success: true } };
  } catch (err) {
    console.error('[ipc] delete-product-type error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: add-hsn-code - add a new HSN code
ipcMain.handle("add-hsn-code", async (event, hsnData) => {
  try {
    console.log('[ipc] add-hsn-code called with:', hsnData);
    const newHSN = await db.addHSNCode(hsnData);
    console.log('[ipc] add-hsn-code saved:', newHSN);
    return { success: true, message: '', data: newHSN };
  } catch (err) {
    console.error('[ipc] add-hsn-code error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: get-hsn-codes - fetch all HSN codes
ipcMain.handle("get-hsn-codes", async (event) => {
  try {
    console.log('[ipc] get-hsn-codes called');
    const codes = await db.getHSNCodes();
    console.log('[ipc] get-hsn-codes returned', codes.length, 'codes');
    return { success: true, message: '', data: codes };
  } catch (err) {
    console.error('[ipc] get-hsn-codes error:', err);
    return { success: false, message: err.message, data: [] };
  }
});

// IPC: update-hsn-code - update an HSN code
ipcMain.handle("update-hsn-code", async (event, hsnCode, hsnData) => {
  try {
    console.log('[ipc] update-hsn-code called with code:', hsnCode, 'data:', hsnData);
    const updated = await db.updateHSNCode(hsnCode, hsnData);
    console.log('[ipc] update-hsn-code updated:', updated);
    return { success: true, message: '', data: updated };
  } catch (err) {
    console.error('[ipc] update-hsn-code error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: delete-hsn-code - delete an HSN code
ipcMain.handle("delete-hsn-code", async (event, hsnCode) => {
  try {
    console.log('[ipc] delete-hsn-code called with code:', hsnCode);
    await db.deleteHSNCode(hsnCode);
    console.log('[ipc] delete-hsn-code deleted code:', hsnCode);
    return { success: true, message: '', data: { success: true } };
  } catch (err) {
    console.error('[ipc] delete-hsn-code error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: create-invoice - create an invoice with items and deduct stock
ipcMain.handle("create-invoice", async (event, invoiceData) => {
  try {
    console.log('[ipc] create-invoice called with:', invoiceData);
    const newInvoice = await db.createInvoice(invoiceData);
    console.log('[ipc] create-invoice created:', newInvoice);
    return { success: true, message: '', data: newInvoice };
  } catch (err) {
    console.error('[ipc] create-invoice error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: get-invoices - fetch all invoices with items
ipcMain.handle("get-invoices", async (event) => {
  try {
    console.log('[ipc] get-invoices called');
    const invoices = await db.getInvoices();
    console.log('[ipc] get-invoices returned', invoices.length, 'invoices');
    return { success: true, message: '', data: { results: invoices, count: invoices.length } };
  } catch (err) {
    console.error('[ipc] get-invoices error:', err);
    return { success: false, message: err.message, data: { results: [], count: 0 } };
  }
});

// IPC: get-invoice-by-id - fetch a single invoice with items
ipcMain.handle("get-invoice-by-id", async (event, invoiceId) => {
  try {
    console.log('[ipc] get-invoice-by-id called with id:', invoiceId);
    const invoice = await db.getInvoiceById(invoiceId);
    if (!invoice) {
      return { success: false, message: 'Invoice not found', data: null };
    }
    console.log('[ipc] get-invoice-by-id returned invoice:', invoiceId);
    return { success: true, message: '', data: invoice };
  } catch (err) {
    console.error('[ipc] get-invoice-by-id error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: delete-invoice - delete invoice and restore stock
ipcMain.handle("delete-invoice", async (event, invoiceId) => {
  try {
    console.log('[ipc] delete-invoice called with id:', invoiceId);
    await db.deleteInvoice(invoiceId);
    console.log('[ipc] delete-invoice deleted id:', invoiceId);
    return { success: true, message: '', data: { success: true } };
  } catch (err) {
    console.error('[ipc] delete-invoice error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: update-invoice - update invoice metadata
ipcMain.handle("update-invoice", async (event, invoiceId, invoiceData) => {
  try {
    console.log('[ipc] update-invoice called with id:', invoiceId, 'data:', invoiceData);
    const updated = await db.updateInvoice(invoiceId, invoiceData);
    console.log('[ipc] update-invoice updated:', updated);
    return { success: true, message: '', data: updated };
  } catch (err) {
    console.error('[ipc] update-invoice error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// ========== DASHBOARD IPC HANDLERS ==========

// IPC: get-dashboard-summary - fetch total products and invoices count
ipcMain.handle("get-dashboard-summary", async (event) => {
  try {
    console.log('[ipc] get-dashboard-summary called');
    const result = await db.getDashboardSummary();
    console.log('[ipc] get-dashboard-summary result:', result);
    return result;
  } catch (err) {
    console.error('[ipc] get-dashboard-summary error:', err);
    return { success: false, message: err.message, data: { totalProducts: 0, recentInvoices: 0 } };
  }
});

// IPC: get-low-stock-items - fetch products below minimum stock level
ipcMain.handle("get-low-stock-items", async (event) => {
  try {
    console.log('[ipc] get-low-stock-items called');
    const result = await db.getLowStockItems();
    console.log('[ipc] get-low-stock-items result:', result);
    return result;
  } catch (err) {
    console.error('[ipc] get-low-stock-items error:', err);
    return { success: false, message: err.message, data: { count: 0, low_stock_items: [] } };
  }
});

// IPC: get-expiry-overview - fetch batches expiring within N months
ipcMain.handle("get-expiry-overview", async (event, months = 1) => {
  try {
    console.log('[ipc] get-expiry-overview called with months:', months);
    const result = await db.getExpiryOverview(months);
    console.log('[ipc] get-expiry-overview result:', result);
    return result;
  } catch (err) {
    console.error('[ipc] get-expiry-overview error:', err);
    return { success: false, message: err.message, data: { batches: [] } };
  }
});

// IPC: get-sales-overview - fetch sales summary for period
ipcMain.handle("get-sales-overview", async (event, period = 'month') => {
  try {
    console.log('[ipc] get-sales-overview called with period:', period);
    const result = await db.getSalesOverview(period);
    console.log('[ipc] get-sales-overview result:', result);
    return result;
  } catch (err) {
    console.error('[ipc] get-sales-overview error:', err);
    return { success: false, message: err.message, data: { total_sales: 0, total_paid: 0, total_due: 0, bill_count: 0 } };
  }
});

// IPC: get-purchase-overview - fetch purchase summary for period
ipcMain.handle("get-purchase-overview", async (event, period = 'month') => {
  try {
    console.log('[ipc] get-purchase-overview called with period:', period);
    const result = await db.getPurchaseOverview(period);
    console.log('[ipc] get-purchase-overview result:', result);
    return result;
  } catch (err) {
    console.error('[ipc] get-purchase-overview error:', err);
    return { success: false, message: err.message, data: { total_purchases: 0, total_paid: 0, total_due: 0, bill_count: 0 } };
  }
});

// IPC: get-recent-invoices - fetch recent invoices
ipcMain.handle("get-recent-invoices", async (event, limit = 10) => {
  try {
    console.log('[ipc] get-recent-invoices called with limit:', limit);
    const result = await db.getRecentInvoices(limit);
    console.log('[ipc] get-recent-invoices result:', result);
    return result;
  } catch (err) {
    console.error('[ipc] get-recent-invoices error:', err);
    return { success: false, message: err.message, data: { invoices: [] } };
  }
});

// ========== PURCHASE BILL IPC HANDLERS ==========

// IPC: create-purchase-bill - create new purchase bill
ipcMain.handle("create-purchase-bill", async (event, billData) => {
  try {
    console.log('[ipc] create-purchase-bill called with data:', billData);
    const bill = await db.createPurchaseBill(billData);
    console.log('[ipc] create-purchase-bill created:', bill);
    return { success: true, message: 'Purchase bill created', data: bill };
  } catch (err) {
    console.error('[ipc] create-purchase-bill error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: get-purchase-bills - fetch all purchase bills
ipcMain.handle("get-purchase-bills", async (event) => {
  try {
    console.log('[ipc] get-purchase-bills called');
    const bills = await db.getPurchaseBills();
    console.log('[ipc] get-purchase-bills result:', bills.length, 'bills');
    return { success: true, message: '', data: { results: bills } };
  } catch (err) {
    console.error('[ipc] get-purchase-bills error:', err);
    return { success: false, message: err.message, data: { results: [] } };
  }
});

// IPC: update-purchase-bill - update purchase bill amount_paid and notes
ipcMain.handle("update-purchase-bill", async (event, billId, billData) => {
  try {
    console.log('[ipc] update-purchase-bill called with id:', billId, 'data:', billData);
    const bill = await db.updatePurchaseBill(billId, billData);
    console.log('[ipc] update-purchase-bill updated:', bill);
    return { success: true, message: 'Purchase bill updated', data: bill };
  } catch (err) {
    console.error('[ipc] update-purchase-bill error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: delete-purchase-bill - delete purchase bill
ipcMain.handle("delete-purchase-bill", async (event, billId) => {
  try {
    console.log('[ipc] delete-purchase-bill called with id:', billId);
    const result = await db.deletePurchaseBill(billId);
    console.log('[ipc] delete-purchase-bill deleted id:', billId);
    return { success: true, message: 'Purchase bill deleted', data: result };
  } catch (err) {
    console.error('[ipc] delete-purchase-bill error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// ========== AUTHENTICATION IPC HANDLERS ==========

// IPC: check-owner-exists - check if owner account exists
ipcMain.handle("check-owner-exists", async (event) => {
  try {
    const exists = await db.ownerExists();
    console.log('[ipc] check-owner-exists:', exists);
    return { success: true, data: { exists } };
  } catch (err) {
    console.error('[ipc] check-owner-exists error:', err);
    return { success: false, message: err.message, data: { exists: false } };
  }
});

// IPC: verify-owner-exists - verify specific owner exists by username (session restoration)
ipcMain.handle("verify-owner-exists", async (event, username) => {
  try {
    console.log('[ipc] verify-owner-exists called for username:', username);
    const owner = await db.verifyOwnerByUsername(username);
    const exists = owner !== null;
    console.log('[ipc] verify-owner-exists:', exists ? 'verified' : 'not found');
    return { success: true, data: { exists, owner: owner || null } };
  } catch (err) {
    console.error('[ipc] verify-owner-exists error:', err);
    return { success: false, message: err.message, data: { exists: false, owner: null } };
  }
});

// IPC: register-owner - create new owner account
ipcMain.handle("register-owner", async (event, username, email, password, firstName, lastName) => {
  try {
    console.log('[ipc] register-owner called for username:', username);
    const owner = await db.registerOwner(username, email, password, firstName, lastName);
    console.log('[ipc] register-owner successful');
    return { success: true, data: owner };
  } catch (err) {
    console.error('[ipc] register-owner error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: login-owner - authenticate owner with username/email and password
ipcMain.handle("login-owner", async (event, username, password) => {
  try {
    console.log('[ipc] login-owner called for username:', username);
    const owner = await db.loginOwner(username, password);
    console.log('[ipc] login-owner successful');
    return { success: true, data: owner };
  } catch (err) {
    console.error('[ipc] login-owner error:', err);
    return { success: false, message: err.message || 'Login failed', data: null };
  }
});

// IPC: get-owner - get current owner information
ipcMain.handle("get-owner", async (event) => {
  try {
    const owner = await db.getOwner();
    console.log('[ipc] get-owner:', owner ? owner.username : 'none');
    return { success: true, data: owner };
  } catch (err) {
    console.error('[ipc] get-owner error:', err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: reset-password-recovery - reset password using recovery code
ipcMain.handle("reset-password-recovery", async (event, username, recoveryCode, newPassword) => {
  try {
    console.log('[ipc] reset-password-recovery called for username:', username);
    const owner = await db.resetPasswordWithRecoveryCode(username, recoveryCode, newPassword);
    console.log('[ipc] reset-password-recovery successful');
    return { success: true, data: owner };
  } catch (err) {
    console.error('[ipc] reset-password-recovery error:', err);
    return { success: false, message: err.message || 'Password reset failed', data: null };
  }
});

// ========== DATABASE BACKUP/RESTORE IPC HANDLERS ==========

// IPC: backup-database - Manual backup of SQLite database
ipcMain.handle("backup-database", async (event) => {
  try {
    console.log('[ipc] backup-database triggered');
    const userDataPath = app.getPath("userData");
    const dbPath = path.join(userDataPath, "medical_store.db");
    
    // Check if database file exists
    if (!fs.existsSync(dbPath)) {
      throw new Error("Database file not found");
    }

    // Generate default filename with current date
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const defaultFilename = `medical_store_backup_${dateStr}.db`;

    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Backup Database",
      defaultPath: defaultFilename,
      filters: [
        { name: "SQLite Database", extensions: ["db"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });

    if (result.canceled || !result.filePath) {
      console.log('[ipc] backup-database canceled by user');
      return { success: false, message: "Backup cancelled" };
    }

    // Copy database file to selected location
    await new Promise((resolve, reject) => {
      fs.copyFile(dbPath, result.filePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('[ipc] backup-database successful:', result.filePath);
    return { success: true, message: `Database backed up to ${result.filePath}` };
  } catch (err) {
    console.error('[ipc] backup-database error:', err);
    return { success: false, message: err.message };
  }
});

// IPC: restore-database - Restore database from backup file
ipcMain.handle("restore-database", async (event) => {
  try {
    console.log('[ipc] restore-database triggered');
    const userDataPath = app.getPath("userData");
    const dbPath = path.join(userDataPath, "medical_store.db");

    // Show open dialog to select backup file
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Restore Database",
      filters: [
        { name: "SQLite Database", extensions: ["db"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });

    if (result.canceled || !result.filePaths.length) {
      console.log('[ipc] restore-database canceled by user');
      return { success: false, message: "Restore cancelled" };
    }

    const backupPath = result.filePaths[0];

    // Verify backup file exists
    if (!fs.existsSync(backupPath)) {
      throw new Error("Selected backup file not found");
    }

    // Close database connection before restore
    console.log('[ipc] closing database connection for restore');
    try {
      const database = await db.getDatabase();
      if (database) {
        await new Promise((resolve, reject) => {
          database.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    } catch (closeErr) {
      console.warn('[ipc] error closing database:', closeErr);
    }

    // Replace current database with backup
    await new Promise((resolve, reject) => {
      fs.copyFile(backupPath, dbPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('[ipc] restore-database successful, relaunching app');
    
    // Relaunch application to reinitialize database
    app.relaunch();
    app.exit(0);
    
    return { success: true, message: "Database restored, app will restart" };
  } catch (err) {
    console.error('[ipc] restore-database error:', err);
    return { success: false, message: err.message };
  }
});

// Receive renderer-side error logs forwarded from preload
ipcMain.on('renderer-error', (event, info) => {
  console.error('[renderer-error] forwarded from renderer:', info);
});

// App lifecycle
app.whenReady().then(async () => {
  
  // Initialize database before creating window
  try {
    await db.initializeDatabase();
    console.log('[electron] Database initialized successfully at app startup');
  } catch (err) {
    console.error('[electron] Failed to initialize database:', err);
  }

  // Check license BEFORE creating main window
  console.log('[electron] Checking license...');
  try {
    licenseValid = await initializeLicense(app);
    console.log('[electron] License status:', licenseValid ? 'VALID' : 'INVALID');
  } catch (err) {
    console.error('[electron] License check error:', err.message);
    licenseValid = false;
  }

  if (licenseValid) {
    // License is valid - create main app window
    console.log('[electron] Creating main application window...');
    createWindow();
  } else {
    // No valid license - create activation window instead
    console.log('[electron] Creating activation window...');
    createActivationWindow();
  }

  createMenu();
});

app.on("window-all-closed", async () => {
  // Auto-backup database before exit
  try {
    const userDataPath = app.getPath("userData");
    const dbPath = path.join(userDataPath, "medical_store.db");
    const backupsDir = path.join(userDataPath, "backups");

    // Check if database exists
    if (fs.existsSync(dbPath)) {
      // Create backups directory if it doesn't exist
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      // Generate backup filename with timestamp
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').split('Z')[0];
      const backupFilename = `auto_backup_${timestamp}.db`;
      const backupPath = path.join(backupsDir, backupFilename);

      // Copy database to backups folder
      await new Promise((resolve, reject) => {
        fs.copyFile(dbPath, backupPath, (err) => {
          if (err) {
            console.error('[auto-backup] Failed to create backup:', err);
            reject(err);
          } else {
            console.log('[auto-backup] Created backup:', backupPath);
            resolve();
          }
        });
      });

      // Clean up old backups (keep only last 7)
      const files = fs.readdirSync(backupsDir)
        .filter(file => file.startsWith('auto_backup_'))
        .map(file => ({
          name: file,
          path: path.join(backupsDir, file),
          time: fs.statSync(path.join(backupsDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > 7) {
        // Delete old backups
        for (let i = 7; i < files.length; i++) {
          try {
            fs.unlinkSync(files[i].path);
            console.log('[auto-backup] Deleted old backup:', files[i].name);
          } catch (err) {
            console.warn('[auto-backup] Failed to delete old backup:', err);
          }
        }
      }
    }
  } catch (err) {
    console.error('[auto-backup] Error during auto-backup:', err);
  }

  // On Windows & Linux quit fully when all windows closed
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// App menu
function createMenu() {
  // In production keep menu minimal so app feels native. Devs still get tools in dev mode
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Exit",
          accelerator: "CmdOrCtrl+Q",
          click: () => app.quit(),
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ],
    },
  ];

  // In dev allow View menu for reload/devtools
  if (!app.isPackaged) {
    template.push({
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Safety
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});
