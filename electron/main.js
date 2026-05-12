const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  dialog,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const net = require("net");
const pdfParseLib = require("pdf-parse");
const { parsePurchaseInvoice } = require("../tools/pdfParser");
// ensure correct resolution both during development (file system) and
// packaged inside app.asar
// compute path to database module in a packaging-friendly way
// during development __dirname points to electron/ folder, in production
// it points inside app.asar. app.getAppPath() returns the asar root path.
function resolveDatabasePath() {
  if (app.isPackaged) {
    // extraResources copies database/ to resources/database/
    // process.resourcesPath points to the resources/ folder
    const candidate = path.join(process.resourcesPath, "database", "db");
    console.log(
      "[electron] resolveDatabasePath (packaged) ->",
      candidate,
      "exists=",
      fs.existsSync(candidate + ".js"),
    );
    return candidate;
  } else {
    // Development: __dirname is electron/ folder
    const candidate = path.join(__dirname, "..", "database", "db");
    console.log(
      "[electron] resolveDatabasePath (dev) ->",
      candidate,
      "exists=",
      fs.existsSync(candidate + ".js"),
    );
    return candidate;
  }
}

const dbPath = resolveDatabasePath();
const db = require(dbPath);

let mainWindow;
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("disable-http-cache");
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
  app.setAppUserModelId("com.choudharyelectrical.billing");
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
    icon: path.join(__dirname, "../build", "icon.png"),
  });

  // Load Vite dev server in development
  if (!app.isPackaged) {
    const devUrl = "http://localhost:5173";
    console.log("[electron] Loading dev server:", devUrl);

    // Log preload path existence
    const preloadPath = path.join(__dirname, "preload.js");
    console.log(
      "[electron] preload path:",
      preloadPath,
      "exists=",
      fs.existsSync(preloadPath),
    );

    // Check TCP connectivity to the dev server port before loading
    const parsed = new URL(devUrl);
    const host = parsed.hostname;
    const port = parseInt(parsed.port, 10) || 80;

    const socket = new net.Socket();
    let connected = false;
    socket.setTimeout(3000);
    socket
      .once("connect", () => {
        connected = true;
        console.log(
          "[electron] TCP connection to",
          host + ":" + port,
          "succeeded",
        );
        socket.destroy();
        mainWindow
          .loadURL(devUrl)
          .catch((err) => console.error("[electron] loadURL error:", err));
        if (!app.isPackaged) {
        }
      })
      .once("timeout", () => {
        console.warn(
          "[electron] TCP connection to",
          host + ":" + port,
          "timed out",
        );
        socket.destroy();
        // Still attempt to load - may fail but will surface did-fail-load
        mainWindow
          .loadURL(devUrl)
          .catch((err) => console.error("[electron] loadURL error:", err));
        if (!app.isPackaged) {
        }
      })
      .once("error", (err) => {
        console.warn(
          "[electron] TCP connection error to",
          host + ":" + port,
          err && err.message,
        );
        // Attempt to load anyway to allow error events to be emitted
        mainWindow
          .loadURL(devUrl)
          .catch((err) => console.error("[electron] loadURL error:", err));
        if (!app.isPackaged) {
        }
      })
      .connect({ host, port });
  } else {
    const prodFile = path.join(
      process.resourcesPath,
      "frontend",
      "dist",
      "index.html",
    );
    console.log(
      "[electron] prodFile:",
      prodFile,
      "exists:",
      fs.existsSync(prodFile),
    );
    // ← TEMPORARY: remove after testing

    mainWindow
      .loadFile(prodFile)
      .then(() => console.log("[electron] loadFile success"))
      .catch((err) => console.error("[electron] loadFile error:", err));
  }

  // Prevent external navigation in production
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (app.isPackaged) {
      event.preventDefault();
    }
  });

  // Helpful debug events to trace loading problems
  mainWindow.webContents.on("did-start-loading", () => {
    console.log("[electron] webContents did-start-loading");
  });

  mainWindow.webContents.on("dom-ready", () => {
    console.log("[electron] webContents dom-ready");
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[electron] webContents did-finish-load");
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error("[electron] did-fail-load", {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      });
    },
  );

  mainWindow.webContents.on("crashed", () => {
    console.error("[electron] webContents crashed");
  });

  // Prevent new windows / external popups by default
  // Allow window.open() for invoice print popup, deny everything else
  mainWindow.webContents.setWindowOpenHandler(({ url, frameName }) => {
    // Allow the invoice print popup (opened with name 'invoice-print')
    if (frameName === "invoice-print") {
      console.log("[electron] Allowing print popup window");
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 750,
          height: 950,
          autoHideMenuBar: true,
          title: "Print Invoice",
          // ✅ No preload needed - popup is plain HTML only
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload-print.js"),
          },
        },
      };
    }

    // Deny everything else (external URLs, unknown popups)
    console.log("[electron] Blocking popup for url:", url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC: handle print requests - open native Electron print dialog
// The native dialog includes "Save as PDF" option
// IPC: print-invoice - print using webContents.print() with preview support
// This approach opens the system's print dialog, allowing users to choose "Save as PDF" or print to a real printer with preview
// ─────────────────────────────────────────────────────────────────────────────
// IPC: print-invoice
// Strategy: hidden BrowserWindow containing ONLY the invoice HTML.
//   • Avoids the @media print "body > * { display:none }" trap in the main window.
//   • Uses loadFile() on a temp file instead of data: URI (no 2 MB size cap).
//   • @media print rules stripped before CSS injection (they were written for
//     window.print() on the full React page — destructive in an isolated window).
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle("print-invoice", async (event) => {
  let printWin = null; // always destroy on exit
  let tempHtmlPath = null; // always delete on exit

  try {
    console.log(
      "[ipc] print-invoice: starting hidden-window PDF generation...",
    );

    if (!mainWindow) throw new Error("Main window is not available");

    // ── 1. Pull rendered invoice HTML from the live React DOM ─────────────────
    // Target: <div id="invoice-print-area"> in InvoiceDetail.jsx
    const invoiceHTML = await mainWindow.webContents.executeJavaScript(`
      (function () {
        const el = document.getElementById('invoice-print-area');
        if (!el) throw new Error('invoice-print-area not found in DOM');
        return el.innerHTML;
      })()
    `);

    if (!invoiceHTML || invoiceHTML.trim() === "") {
      throw new Error("invoice-print-area was empty — nothing to print");
    }
    console.log(
      "[ipc] print-invoice: invoice HTML captured, length:",
      invoiceHTML.length,
    );

    // ── 2. Collect all CSS active in the main window ──────────────────────────
    // Pass 1 — CSSStyleSheet rules (Vite-linked .css files)
    // Pass 2 — <style> tag textContent (Vite HMR injected styles, index.html)
    // cross-origin sheets (CDN fonts etc.) are silently skipped
    const allCSS = await mainWindow.webContents.executeJavaScript(`
      (function () {
        let css = '';

        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules || [])) {
              css += rule.cssText + '\\n';
            }
          } catch (e) {
            // cross-origin sheet — skip
          }
        }

        for (const tag of Array.from(document.querySelectorAll('style'))) {
          css += tag.textContent + '\\n';
        }

        return css;
      })()
    `);
    console.log("[ipc] print-invoice: CSS captured, length:", allCSS.length);

    // ── 3. Strip @media print blocks ──────────────────────────────────────────
    // InvoicePrint.css contains  body > * { display:none !important }
    // inside @media print.  In the isolated hidden window there is no React,
    // no #root, no nav — those rules are not only useless, they would hide
    // the invoice content itself.  Remove every @media print { ... } block.
    const cssForPrint = allCSS.replace(
      /@media\s+print\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gi,
      "",
    );
    console.log("[ipc] print-invoice: @media print blocks stripped");

    // ── 4. Build self-contained HTML document ─────────────────────────────────
    // Wrap injected HTML in the same class selectors InvoicePrint.css targets.
    const htmlDoc = `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Invoice</title>
        <style>
          /* ── isolation reset ── */
          *, *::before, *::after { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 13px;
            color: #000000;
          }
          .invoice-print-wrapper,
          .invoice-print {
            width: 100%;
          }
        </style>
        <style>
          /* ── all app styles (@media print blocks removed) ── */
          ${cssForPrint}
        </style>
      </head>
      <body>
        <div class="invoice-print-wrapper">
          <div class="invoice-print">
            ${invoiceHTML}
          </div>
        </div>
      </body>
      </html>`;

    // ── 5. Write to temp file (no data: URI size limit) ───────────────────────
    tempHtmlPath = path.join(os.tmpdir(), `invoice_print_${Date.now()}.html`);
    fs.writeFileSync(tempHtmlPath, htmlDoc, "utf8");
    console.log("[ipc] print-invoice: temp HTML written to:", tempHtmlPath);

    // ── 6. Create hidden BrowserWindow ────────────────────────────────────────
    printWin = new BrowserWindow({
      show: false,
      width: 900, // wide enough for A4 portrait
      height: 1200,
      webPreferences: {
        javascript: true,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    await printWin.loadFile(tempHtmlPath);
    console.log("[ipc] print-invoice: hidden window loaded");

    // ── 7. Short layout settle delay ──────────────────────────────────────────
    // did-finish-load fires after parse; give fonts/tables time to lay out.
    await new Promise((resolve) => setTimeout(resolve, 300));

    // ── 8. Generate PDF from the clean isolated window ────────────────────────
    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      landscape: false,
      marginsType: 1, // 0 = default  1 = none  2 = minimum
      displayHeaderFooter: false,
    });
    console.log(
      "[ipc] print-invoice: PDF buffer generated, size:",
      pdfBuffer.length,
    );

    // ── 9. Destroy hidden window immediately ──────────────────────────────────
    printWin.destroy();
    printWin = null;

    // ── 10. Save PDF and open in default viewer ───────────────────────────────
    const pdfPath = path.join(os.tmpdir(), `invoice_${Date.now()}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log("[ipc] print-invoice: PDF saved to:", pdfPath);

    const openError = await shell.openPath(pdfPath);
    if (openError) throw new Error(`shell.openPath failed: ${openError}`);

    console.log("[ipc] print-invoice: PDF opened in viewer successfully");
    return { success: true, pdfPath };
  } catch (err) {
    console.error("[ipc] print-invoice ERROR:", err.message);

    if (printWin && !printWin.isDestroyed()) {
      printWin.destroy();
    }

    return { success: false, message: err.message };
  } finally {
    // Always remove the intermediate HTML file; PDF file stays for the viewer.
    if (tempHtmlPath) {
      try {
        fs.unlinkSync(tempHtmlPath);
      } catch (_) {
        /* ignore */
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// FEATURE 1 — Download Invoice as PDF (save dialog)
// ═══════════════════════════════════════════════════════════════
ipcMain.handle("download-invoice", async (event) => {
  let tempHtmlPath = null;
  let pdfWin = null;

  try {
    const { BrowserWindow, dialog } = require("electron");
    const os = require("os");
    const fs = require("fs");
    const path = require("path");

    // ── Step 1: Capture invoice HTML from main window (same as print-invoice) ──
    const mainWin = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
    if (!mainWin) throw new Error("Main window not found");

    const captureResult = await mainWin.webContents.executeJavaScript(`
      (() => {
        const el = document.getElementById('invoice-print-area');
        if (!el) return { success: false, error: 'invoice-print-area not found' };

        // Capture all stylesheets
        let css = '';
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule instanceof CSSMediaRule) {
                // Skip @media print blocks — not needed for PDF
                continue;
              }
              css += rule.cssText + '\\n';
            }
          } catch(e) { /* cross-origin sheet — skip */ }
        }

        return {
          success: true,
          html: el.innerHTML,
          css: css
        };
      })()
    `);

    if (!captureResult.success) {
      throw new Error(captureResult.error || "Failed to capture invoice HTML");
    }

    // ── Step 2: Build complete HTML document ──
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: white; font-family: Arial, sans-serif; }
    ${captureResult.css}
  </style>
</head>
<body>
  <div class="invoice-print-wrapper">
    ${captureResult.html}
  </div>
</body>
</html>`;

    // ── Step 3: Write to temp file ──
    tempHtmlPath = path.join(
      os.tmpdir(),
      `ojashwai-invoice-${Date.now()}.html`,
    );
    fs.writeFileSync(tempHtmlPath, fullHtml, "utf8");

    // ── Step 4: Show save dialog to user ──
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Save Invoice PDF",
      defaultPath: path.join(
        require("electron").app.getPath("downloads"),
        `Invoice-${Date.now()}.pdf`,
      ),
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    });

    if (canceled || !filePath) {
      return { success: false, message: "Cancelled by user" };
    }

    // ── Step 5: Load HTML in hidden window and print to PDF ──
    pdfWin = new BrowserWindow({
      show: false,
      width: 794,
      height: 1123,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        javascript: true,
      },
    });

    await pdfWin.loadFile(tempHtmlPath);

    // Small delay for CSS/images to render
    await new Promise((resolve) => setTimeout(resolve, 800));

    const pdfData = await pdfWin.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      margins: { marginType: "custom", top: 0, bottom: 0, left: 0, right: 0 },
    });

    // ── Step 6: Save PDF to user-chosen path ──
    fs.writeFileSync(filePath, pdfData);
    console.log("[download-invoice] PDF saved to:", filePath);

    // ── Step 7: Open the saved PDF ──
    await shell.openPath(filePath);

    return { success: true, filePath };
  } catch (err) {
    console.error("[download-invoice] Error:", err.message);
    return { success: false, message: err.message };
  } finally {
    // Always clean up
    if (pdfWin && !pdfWin.isDestroyed()) pdfWin.close();
    if (tempHtmlPath) {
      try {
        require("fs").unlinkSync(tempHtmlPath);
      } catch (e) {}
    }
  }
});

// ── download-invoice-silent (for WhatsApp flow) ───────────────
ipcMain.handle("download-invoice-silent", async (event) => {
  let tempHtmlPath = null;
  let pdfWin = null;

  try {
    const { BrowserWindow, app } = require("electron");
    const os = require("os");
    const fs = require("fs");
    const path = require("path");

    const mainWin = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
    if (!mainWin) throw new Error("Main window not found");

    // Capture HTML (same as download-invoice)
    const captureResult = await mainWin.webContents.executeJavaScript(`
      (() => {
        const el = document.getElementById('invoice-print-area');
        if (!el) return { success: false, error: 'invoice-print-area not found' };
        let css = '';
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule instanceof CSSMediaRule) continue;
              css += rule.cssText + '\\n';
            }
          } catch(e) {}
        }
        return { success: true, html: el.innerHTML, css };
      })()
    `);

    if (!captureResult.success) throw new Error(captureResult.error);

    const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: white; font-family: Arial, sans-serif; }
  ${captureResult.css}
</style></head>
<body><div class="invoice-print-wrapper">${captureResult.html}</div></body>
</html>`;

    tempHtmlPath = path.join(os.tmpdir(), `ojashwai-wa-${Date.now()}.html`);
    fs.writeFileSync(tempHtmlPath, fullHtml, "utf8");

    pdfWin = new BrowserWindow({
      show: false,
      width: 794,
      height: 1123,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    await pdfWin.loadFile(tempHtmlPath);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const pdfData = await pdfWin.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      margins: { marginType: "custom", top: 0, bottom: 0, left: 0, right: 0 },
    });

    // Auto-save to Downloads — no dialog
    const fileName = `Invoice-${Date.now()}.pdf`;
    const filePath = path.join(app.getPath("downloads"), fileName);
    fs.writeFileSync(filePath, pdfData);

    console.log("[download-invoice-silent] Saved to:", filePath);
    return { success: true, filePath };
  } catch (err) {
    console.error("[download-invoice-silent] Error:", err.message);
    return { success: false, message: err.message };
  } finally {
    if (pdfWin && !pdfWin.isDestroyed()) pdfWin.close();
    if (tempHtmlPath) {
      try {
        require("fs").unlinkSync(tempHtmlPath);
      } catch (e) {}
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// Download HSN GST Report as PDF
// ═══════════════════════════════════════════════════════════════
ipcMain.handle("download-hsn-report", async (event, { html }) => {
  let tempHtmlPath = null;
  let pdfWin = null;

  try {
    const { BrowserWindow, dialog, app } = require("electron");
    const os = require("os");
    const fs = require("fs");
    const path = require("path");

    // ── Step 1: Write HTML to temp file ──
    tempHtmlPath = path.join(
      os.tmpdir(),
      `ojashwai-hsn-report-${Date.now()}.html`,
    );
    fs.writeFileSync(tempHtmlPath, html, "utf8");

    // ── Step 2: Show save dialog ──
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Save HSN GST Report",
      defaultPath: path.join(
        app.getPath("downloads"),
        `HSN-GST-Report-${Date.now()}.pdf`,
      ),
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    });

    if (canceled || !filePath) {
      return { success: false, message: "Cancelled by user" };
    }

    // ── Step 3: Load in hidden window ──
    pdfWin = new BrowserWindow({
      show: false,
      width: 1200,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    await pdfWin.loadFile(tempHtmlPath);
    await new Promise((resolve) => setTimeout(resolve, 600));

    // ── Step 4: Print to PDF ──
    const pdfData = await pdfWin.webContents.printToPDF({
      printBackground: true,
      pageSize: "A3", // wider than A4 — fits the wide table
      landscape: true, // landscape for wide columns
      margins: {
        marginType: "custom",
        top: 0.4,
        bottom: 0.4,
        left: 0.4,
        right: 0.4,
      },
    });

    // ── Step 5: Save ──
    fs.writeFileSync(filePath, pdfData);
    console.log("[download-hsn-report] PDF saved to:", filePath);

    // ── Step 6: Open ──
    await shell.openPath(filePath);

    return { success: true, filePath };
  } catch (err) {
    console.error("[download-hsn-report] Error:", err.message);
    return { success: false, message: err.message };
  } finally {
    if (pdfWin && !pdfWin.isDestroyed()) pdfWin.close();
    if (tempHtmlPath) {
      try {
        require("fs").unlinkSync(tempHtmlPath);
      } catch (e) {}
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// FEATURE 2 — WhatsApp Share
// ═══════════════════════════════════════════════════════════════
ipcMain.handle("share-whatsapp", async (event, payload) => {
  try {
    const { message, useWeb } = payload;
    const encoded = encodeURIComponent(message);

    const url = useWeb
      ? `https://web.whatsapp.com/send?text=${encoded}`
      : `whatsapp://send?text=${encoded}`;

    console.log("[share-whatsapp] Opening:", url);
    await shell.openExternal(url);

    return { success: true };
  } catch (err) {
    console.error("[share-whatsapp] Error:", err.message);
    return { success: false, message: err.message };
  }
});

// IPC: add-product - insert product with batches into SQLite
ipcMain.handle("add-product", async (event, productData) => {
  try {
    console.log("[ipc] add-product: Received", {
      name: productData.name,
      batches: productData.batches?.length,
    });
    const savedProduct = await db.addProduct(productData);

    if (!savedProduct || !savedProduct.id || !savedProduct.name) {
      console.error(
        "[ipc] add-product: Invalid product returned:",
        savedProduct,
      );
      throw new Error("Server returned incomplete product data");
    }

    console.log("[ipc] add-product: Success -", {
      id: savedProduct.id,
      name: savedProduct.name,
      batches: savedProduct.batches?.length,
    });
    return {
      success: true,
      message: "Product added successfully",
      data: savedProduct,
    };
  } catch (err) {
    console.error("[ipc] add-product: ERROR -", err.message);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: get-products - fetch all products with batches from SQLite
ipcMain.handle("get-products", async (event) => {
  try {
    console.log("[ipc] get-products called");
    const products = await db.getProducts();
    console.log(
      "[ipc] get-products returned",
      products.length,
      "products with gst_rate:",
      products.slice(0, 3).map((p) => ({
        id: p.id,
        name: p.name,
        hsn: p.hsn,
        gst_rate: p.gst_rate,
        batchCount: p.batches?.length || 0,
      })),
    );
    return {
      success: true,
      message: "",
      data: { results: products, count: products.length },
    };
  } catch (err) {
    console.error("[ipc] get-products error:", err);
    return {
      success: false,
      message: err.message,
      data: { results: [], count: 0 },
    };
  }
});

// IPC: search-products - search products by name, generic_name, salt_composition
ipcMain.handle("search-products", async (event, query) => {
  try {
    console.log("[ipc] search-products called with query:", query);
    const results = await db.searchProducts(query);
    console.log("[ipc] search-products returned", results.length, "results");
    return { success: true, message: "", data: { results: results || [] } };
  } catch (err) {
    console.error("[ipc] search-products error:", err);
    return { success: false, message: err.message, data: { results: [] } };
  }
});

// IPC: update-product - update product and batches in SQLite
ipcMain.handle("update-product", async (event, productId, productData) => {
  try {
    console.log("[ipc] update-product called with id:", productId);
    const updatedProduct = await db.updateProduct(productId, productData);
    if (!updatedProduct || !updatedProduct.id) {
      console.error("[ipc] update-product: Incomplete product returned");
      throw new Error("Incomplete product data");
    }
    console.log("[ipc] update-product success");
    return { success: true, message: "", data: updatedProduct };
  } catch (err) {
    console.error("[ipc] update-product ERROR:", err.message);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: delete-product - delete product and related batches from SQLite
ipcMain.handle("delete-product", async (event, productId) => {
  try {
    console.log("[ipc] delete-product called with id:", productId);

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

    console.log("[ipc] delete-product successfully deleted id:", productId);
    return {
      success: true,
      message: `Product ${productId} deleted successfully`,
      data: { productId, success: true },
    };
  } catch (err) {
    console.error("[ipc] delete-product error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: add-wholesaler - insert wholesaler into SQLite
ipcMain.handle("add-wholesaler", async (event, wholesalerData) => {
  try {
    console.log("[ipc] add-wholesaler called with:", wholesalerData);
    const savedWholesaler = await db.addWholesaler(wholesalerData);
    console.log("[ipc] add-wholesaler saved:", savedWholesaler);
    return { success: true, message: "", data: savedWholesaler };
  } catch (err) {
    console.error("[ipc] add-wholesaler error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: get-wholesalers - fetch all wholesalers from SQLite
ipcMain.handle("get-wholesalers", async (event) => {
  try {
    console.log("[ipc] get-wholesalers called");
    const wholesalers = await db.getWholesalers();
    console.log(
      "[ipc] get-wholesalers returned",
      wholesalers.length,
      "wholesalers",
    );
    return {
      success: true,
      message: "",
      data: { results: wholesalers, count: wholesalers.length },
    };
  } catch (err) {
    console.error("[ipc] get-wholesalers error:", err);
    return {
      success: false,
      message: err.message,
      data: { results: [], count: 0 },
    };
  }
});

// IPC: update-wholesaler - update wholesaler in SQLite
ipcMain.handle("update-wholesaler", async (event, id, wholesalerData) => {
  try {
    console.log(
      "[ipc] update-wholesaler called with id:",
      id,
      "data:",
      wholesalerData,
    );
    const updatedWholesaler = await db.updateWholesaler(id, wholesalerData);
    console.log("[ipc] update-wholesaler updated:", updatedWholesaler);
    return { success: true, message: "", data: updatedWholesaler };
  } catch (err) {
    console.error("[ipc] update-wholesaler error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: delete-wholesaler - delete wholesaler from SQLite
ipcMain.handle("delete-wholesaler", async (event, id) => {
  try {
    console.log("[ipc] delete-wholesaler called with id:", id);
    await db.deleteWholesaler(id);
    console.log("[ipc] delete-wholesaler deleted id:", id);
    return { success: true, message: "", data: { success: true } };
  } catch (err) {
    console.error("[ipc] delete-wholesaler error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// Invoice number helpers
function getFinancialYear() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  if (month >= 4) {
    return `${year}-${String(year + 1).slice(-2)}`;
  } else {
    return `${year - 1}-${String(year).slice(-2)}`;
  }
}

ipcMain.handle("get-next-invoice-number", () => {
  try {
    const invoiceNumber = db.getNextInvoiceNumber();
    return { success: true, invoice_number: invoiceNumber };
  } catch (error) {
    console.error("[ipc] get-next-invoice-number error:", error);
    return { success: false, error: error.message };
  }
});

// IPC: get-settings - fetch shop settings from SQLite
ipcMain.handle("get-settings", async (event) => {
  try {
    console.log("[ipc] get-settings called");
    const settings = await db.getSettings();
    console.log("[ipc] get-settings returned:", settings);
    return { success: true, message: "", data: settings };
  } catch (err) {
    console.error("[ipc] get-settings error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: save-settings - insert or update shop settings in SQLite
// ⚠️  IMPORTANT: Always preserve bank_qr_path from existing DB row.
//     The ShopDetails form does NOT include bank_qr_path in its payload,
//     so a plain db.saveSettings(settingsData) would wipe the QR path to ''.
ipcMain.handle("save-settings", async (event, settingsData) => {
  try {
    console.log("[ipc] save-settings called with:", settingsData);

    // ── Step 1: Read the current row BEFORE any write ─────────────────────
    const existing = await db.getSettings();
    const existingQrPath = existing?.bank_qr_path || "";
    console.log("[ipc] save-settings: existingQrPath =", existingQrPath);
    console.log(
      "[ipc] save-settings: incomingQrPath =",
      settingsData.bank_qr_path,
    );

    // ── Step 2: Merge — never let an empty/missing value overwrite a good path
    const mergedData = {
      ...settingsData,
      bank_qr_path: settingsData.bank_qr_path || existingQrPath,
    };
    console.log("[ipc] save-settings: mergedQrPath =", mergedData.bank_qr_path);

    // ── Step 3: Save the merged payload ───────────────────────────────────
    const saved = await db.saveSettings(mergedData);
    console.log("[ipc] save-settings saved successfully");
    return { success: true, message: "", data: saved };
  } catch (err) {
    console.error("[ipc] save-settings error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: pick-qr-image - open dialog to select QR image file
ipcMain.handle("pick-qr-image", async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
    });
    return {
      canceled: result.canceled,
      path: result.filePaths[0] || null,
    };
  } catch (err) {
    console.error("[ipc] pick-qr-image error:", err);
    return { canceled: true, path: null };
  }
});

// IPC: save-qr-image - copy QR image to userData and save path
ipcMain.handle("save-qr-image", async (event, sourcePath) => {
  try {
    console.log("[ipc] save-qr-image called with sourcePath:", sourcePath);

    const imagesDir = path.join(app.getPath("userData"), "images");
    // Create images directory if it doesn't exist
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const destPath = path.join(imagesDir, "bank_qr.png");
    fs.copyFileSync(sourcePath, destPath);
    console.log("[ipc] save-qr-image: file copied to", destPath);

    // Fetch current settings and merge with QR path
    const currentSettings = await db.getSettings();
    console.log("[ipc] save-qr-image: current settings retrieved");

    const updatedSettings = {
      ...currentSettings,
      bank_qr_path: destPath,
    };

    // Save the updated settings with QR path
    await db.saveSettings(updatedSettings);
    console.log("[ipc] save-qr-image: settings saved");

    return { success: true, path: destPath };
  } catch (err) {
    console.error("[ipc] save-qr-image error:", err);
    return { success: false, path: null, error: err.message };
  }
});

// IPC: get-qr-image - read QR image as base64 data URL
ipcMain.handle("get-qr-image", async (event) => {
  try {
    console.log("[ipc] get-qr-image called");

    const settings = await db.getSettings();
    const qrPath = settings?.bank_qr_path;

    console.log("[ipc] get-qr-image: qrPath from settings:", qrPath);

    if (!qrPath || !fs.existsSync(qrPath)) {
      console.log("[ipc] get-qr-image: QR file not found at", qrPath);
      return { success: false, dataUrl: null };
    }

    const fileBuffer = fs.readFileSync(qrPath);
    const base64 = fileBuffer.toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    console.log(
      "[ipc] get-qr-image: successfully read QR file, dataUrl length:",
      dataUrl.length,
    );
    return { success: true, dataUrl };
  } catch (err) {
    console.error("[ipc] get-qr-image error:", err);
    return { success: false, dataUrl: null, error: err.message };
  }
});

// IPC: add-product-type - add a custom product type
ipcMain.handle("add-product-type", async (event, typeData) => {
  try {
    console.log("[ipc] add-product-type called with:", typeData);
    const newType = await db.addProductType(typeData);
    console.log("[ipc] add-product-type saved:", newType);
    return { success: true, message: "", data: newType };
  } catch (err) {
    console.error("[ipc] add-product-type error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: get-product-types - fetch all product types
ipcMain.handle("get-product-types", async (event) => {
  try {
    console.log("[ipc] get-product-types called");
    const types = await db.getProductTypes();
    console.log("[ipc] get-product-types returned", types.length, "types");
    return { success: true, message: "", data: types };
  } catch (err) {
    console.error("[ipc] get-product-types error:", err);
    return { success: false, message: err.message, data: [] };
  }
});

// IPC: delete-product-type - delete a custom product type
ipcMain.handle("delete-product-type", async (event, typeId) => {
  try {
    console.log("[ipc] delete-product-type called with id:", typeId);
    await db.deleteProductType(typeId);
    console.log("[ipc] delete-product-type deleted id:", typeId);
    return { success: true, message: "", data: { success: true } };
  } catch (err) {
    console.error("[ipc] delete-product-type error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: add-hsn-code - add a new HSN code
ipcMain.handle("add-hsn-code", async (event, hsnData) => {
  try {
    console.log("[ipc] add-hsn-code called with:", hsnData);
    const newHSN = await db.addHSNCode(hsnData);
    console.log("[ipc] add-hsn-code saved:", newHSN);
    return { success: true, message: "", data: newHSN };
  } catch (err) {
    console.error("[ipc] add-hsn-code error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: get-hsn-codes - fetch all HSN codes
ipcMain.handle("get-hsn-codes", async (event) => {
  try {
    console.log("[ipc] get-hsn-codes called");
    const codes = await db.getHSNCodes();
    console.log("[ipc] get-hsn-codes returned", codes.length, "codes");
    return { success: true, message: "", data: codes };
  } catch (err) {
    console.error("[ipc] get-hsn-codes error:", err);
    return { success: false, message: err.message, data: [] };
  }
});

// IPC: update-hsn-code - update an HSN code
ipcMain.handle("update-hsn-code", async (event, hsnCode, hsnData) => {
  try {
    console.log(
      "[ipc] update-hsn-code called with code:",
      hsnCode,
      "data:",
      hsnData,
    );
    const updated = await db.updateHSNCode(hsnCode, hsnData);
    console.log("[ipc] update-hsn-code updated:", updated);
    return { success: true, message: "", data: updated };
  } catch (err) {
    console.error("[ipc] update-hsn-code error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: delete-hsn-code - delete an HSN code
ipcMain.handle("delete-hsn-code", async (event, hsnCode) => {
  try {
    console.log("[ipc] delete-hsn-code called with code:", hsnCode);
    await db.deleteHSNCode(hsnCode);
    console.log("[ipc] delete-hsn-code deleted code:", hsnCode);
    return { success: true, message: "", data: { success: true } };
  } catch (err) {
    console.error("[ipc] delete-hsn-code error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// ── HSN GST Report ────────────────────────────────────────────
ipcMain.handle("get-hsn-gst-report", async (event, params) => {
  try {
    const result = db.getHSNGSTReport(params);
    return result;
  } catch (err) {
    console.error("[main] get-hsn-gst-report error:", err.message);
    return { success: false, message: err.message };
  }
});

// IPC: create-invoice - create an invoice with items and deduct stock
ipcMain.handle("create-invoice", (event, invoiceData) => {
  try {
    console.log("[ipc] create-invoice called with:", invoiceData);
    if (
      !invoiceData.invoice_number ||
      invoiceData.invoice_number.trim() === ""
    ) {
      invoiceData.invoice_number = db.getNextInvoiceNumber();
      console.log(
        "[ipc] create-invoice generated invoice_number:",
        invoiceData.invoice_number,
      );
    }
    const newInvoice = db.createInvoice(invoiceData);
    console.log("[ipc] create-invoice created:", newInvoice);
    return { success: true, message: "", data: newInvoice };
  } catch (err) {
    console.error("[ipc] create-invoice error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: get-invoices - fetch all invoices with items
ipcMain.handle("get-invoices", (event) => {
  try {
    console.log("[ipc] get-invoices called");
    const invoices = db.getInvoices();
    console.log("[ipc] get-invoices returned", invoices.length, "invoices");
    return {
      success: true,
      message: "",
      data: { results: invoices, count: invoices.length },
    };
  } catch (err) {
    console.error("[ipc] get-invoices error:", err);
    return {
      success: false,
      message: err.message,
      data: { results: [], count: 0 },
    };
  }
});

// IPC: get-invoice-by-id - fetch a single invoice with items
ipcMain.handle("get-invoice-by-id", (event, invoiceId) => {
  try {
    console.log("[ipc] get-invoice-by-id called with id:", invoiceId);
    const invoice = db.getInvoiceById(invoiceId);
    if (!invoice) {
      return { success: false, message: "Invoice not found", data: null };
    }
    console.log("[ipc] get-invoice-by-id returned invoice:", invoiceId);
    return { success: true, message: "", data: invoice };
  } catch (err) {
    console.error("[ipc] get-invoice-by-id error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: delete-invoice - delete invoice and restore stock
ipcMain.handle("delete-invoice", (event, invoiceId) => {
  try {
    console.log("[ipc] delete-invoice called with id:", invoiceId);
    db.deleteInvoice(invoiceId);
    console.log("[ipc] delete-invoice deleted id:", invoiceId);
    return { success: true, message: "", data: { success: true } };
  } catch (err) {
    console.error("[ipc] delete-invoice error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: update-invoice - update invoice metadata
ipcMain.handle("update-invoice", (event, invoiceId, invoiceData) => {
  try {
    console.log(
      "[ipc] update-invoice called with id:",
      invoiceId,
      "data:",
      invoiceData,
    );
    const updated = db.updateInvoice(invoiceId, invoiceData);
    console.log("[ipc] update-invoice updated:", updated);
    return { success: true, message: "", data: updated };
  } catch (err) {
    console.error("[ipc] update-invoice error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// ========== CUSTOMER IPC HANDLERS ==========

// IPC: get-all-customers - fetch all customers for dropdown
ipcMain.handle("get-all-customers", async (event) => {
  try {
    console.log("[ipc] get-all-customers called");
    const customers = await db.getAllCustomers();
    console.log(
      "[ipc] get-all-customers returned",
      customers.length,
      "customers",
    );
    return { success: true, data: customers };
  } catch (err) {
    console.error("[ipc] get-all-customers error:", err);
    return { success: false, message: err.message, data: [] };
  }
});

// IPC: get-customer-by-id - fetch single customer details
ipcMain.handle("get-customer-by-id", async (event, customerId) => {
  try {
    console.log("[ipc] get-customer-by-id called with id:", customerId);
    const customer = await db.getCustomerById(customerId);
    console.log(
      "[ipc] get-customer-by-id returned customer:",
      customer?.customer_name,
    );
    return { success: true, data: customer };
  } catch (err) {
    console.error("[ipc] get-customer-by-id error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: search-customers - search customers by name or phone
ipcMain.handle("search-customers", async (event, searchTerm) => {
  try {
    console.log("[ipc] search-customers called with term:", searchTerm);
    const customers = await db.searchCustomers(searchTerm);
    console.log(
      "[ipc] search-customers returned",
      customers.length,
      "matching customers",
    );
    return { success: true, data: customers };
  } catch (err) {
    console.error("[ipc] search-customers error:", err);
    return { success: false, message: err.message, data: [] };
  }
});

// IPC: save-or-update-customer - create new or update existing customer
ipcMain.handle("save-or-update-customer", async (event, customerData) => {
  try {
    console.log("[ipc] save-or-update-customer called");
    const customer = await db.saveOrUpdateCustomer(customerData);
    console.log("[ipc] save-or-update-customer saved customer:", customer?.id);
    return { success: true, data: customer };
  } catch (err) {
    console.error("[ipc] save-or-update-customer error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: update-customer - update existing customer
ipcMain.handle("update-customer", async (event, customerId, customerData) => {
  try {
    console.log("[ipc] update-customer called with id:", customerId);
    const customer = await db.updateCustomer(customerId, customerData);
    console.log("[ipc] update-customer updated customer:", customer?.id);
    return { success: true, data: customer };
  } catch (err) {
    console.error("[ipc] update-customer error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// ========== DASHBOARD IPC HANDLERS ==========

// IPC: get-dashboard-summary - fetch total products and invoices count
ipcMain.handle("get-dashboard-summary", async (event) => {
  try {
    console.log("[ipc] get-dashboard-summary called");
    const result = await db.getDashboardSummary();
    console.log("[ipc] get-dashboard-summary result:", result);
    return result;
  } catch (err) {
    console.error("[ipc] get-dashboard-summary error:", err);
    return {
      success: false,
      message: err.message,
      data: { totalProducts: 0, recentInvoices: 0 },
    };
  }
});

// IPC: get-low-stock-items - fetch products below minimum stock level
ipcMain.handle("get-low-stock-items", async (event) => {
  try {
    console.log("[ipc] get-low-stock-items called");
    const result = await db.getLowStockItems();
    console.log("[ipc] get-low-stock-items result:", result);
    return result;
  } catch (err) {
    console.error("[ipc] get-low-stock-items error:", err);
    return {
      success: false,
      message: err.message,
      data: { count: 0, low_stock_items: [] },
    };
  }
});

// IPC: get-expiry-overview - REMOVED (not applicable to electric shop)

// IPC: get-sales-overview - fetch sales summary for period
ipcMain.handle("get-sales-overview", async (event, period = "month") => {
  try {
    console.log("[ipc] get-sales-overview called with period:", period);
    const result = await db.getSalesOverview(period);
    console.log("[ipc] get-sales-overview result:", result);
    return result;
  } catch (err) {
    console.error("[ipc] get-sales-overview error:", err);
    return {
      success: false,
      message: err.message,
      data: { total_sales: 0, total_paid: 0, total_due: 0, bill_count: 0 },
    };
  }
});

// IPC: get-purchase-overview - fetch purchase summary for period
ipcMain.handle("get-purchase-overview", async (event, period = "month") => {
  try {
    console.log("[ipc] get-purchase-overview called with period:", period);
    const result = await db.getPurchaseOverview(period);
    console.log("[ipc] get-purchase-overview result:", result);
    return result;
  } catch (err) {
    console.error("[ipc] get-purchase-overview error:", err);
    return {
      success: false,
      message: err.message,
      data: { total_purchases: 0, total_paid: 0, total_due: 0, bill_count: 0 },
    };
  }
});

// IPC: get-recent-invoices - fetch recent invoices
ipcMain.handle("get-recent-invoices", async (event, limit = 10) => {
  try {
    console.log("[ipc] get-recent-invoices called with limit:", limit);
    const result = await db.getRecentInvoices(limit);
    console.log("[ipc] get-recent-invoices result:", result);
    return result;
  } catch (err) {
    console.error("[ipc] get-recent-invoices error:", err);
    return { success: false, message: err.message, data: { invoices: [] } };
  }
});

// ========== PURCHASE BILL IPC HANDLERS ==========

// IPC: show-open-dialog - open file selection dialog
ipcMain.handle("show-open-dialog", async (event, options) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
  } catch (err) {
    console.error("[ipc] show-open-dialog error:", err);
    return { canceled: true, filePaths: [] };
  }
});

// IPC: import-purchase-pdf - read PDF and extract purchase bill data
ipcMain.handle("import-purchase-pdf", async (event, filePath) => {
  try {
    console.log("[ipc] import-purchase-pdf called with file:", filePath);

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error("File not found");
    }

    // Read PDF file
    const pdfBuffer = fs.readFileSync(filePath);

    const pdfData = await pdfParseLib(pdfBuffer);

    if (!pdfData || !pdfData.text) {
      throw new Error(
        "No text extracted from PDF. PDF may be scanned/image-based.",
      );
    }

    const rawText = pdfData.text;
    console.log("[debug] raw text sample:\n", rawText.substring(0, 2000));

    // Parse the extracted text to get structured data
    const parsedData = parsePurchaseInvoice(rawText);

    console.log("[ipc] import-purchase-pdf extracted:", parsedData);

    return {
      success: true,
      message: "PDF imported successfully",
      data: parsedData,
    };
  } catch (err) {
    console.error("[ipc] import-purchase-pdf error:", err);
    return {
      success: false,
      message: err.message || "Failed to import PDF",
      data: null,
    };
  }
});

// IPC: create-purchase-bill - create new purchase bill
ipcMain.handle("create-purchase-bill", async (event, billData) => {
  try {
    console.log("[ipc] create-purchase-bill called with data:", billData);
    const bill = await db.createPurchaseBill(billData);
    console.log("[ipc] create-purchase-bill created:", bill);
    return { success: true, message: "Purchase bill created", data: bill };
  } catch (err) {
    console.error("[ipc] create-purchase-bill error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: get-purchase-bills - fetch all purchase bills
ipcMain.handle("get-purchase-bills", async (event) => {
  try {
    console.log("[ipc] get-purchase-bills called");
    const bills = await db.getPurchaseBills();
    console.log("[ipc] get-purchase-bills result:", bills.length, "bills");
    return { success: true, message: "", data: { results: bills } };
  } catch (err) {
    console.error("[ipc] get-purchase-bills error:", err);
    return { success: false, message: err.message, data: { results: [] } };
  }
});

// IPC: update-purchase-bill - update purchase bill amount_paid and notes
ipcMain.handle("update-purchase-bill", async (event, billId, billData) => {
  try {
    console.log(
      "[ipc] update-purchase-bill called with id:",
      billId,
      "data:",
      billData,
    );
    const bill = await db.updatePurchaseBill(billId, billData);
    console.log("[ipc] update-purchase-bill updated:", bill);
    return { success: true, message: "Purchase bill updated", data: bill };
  } catch (err) {
    console.error("[ipc] update-purchase-bill error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: delete-purchase-bill - delete purchase bill
ipcMain.handle("delete-purchase-bill", async (event, billId) => {
  try {
    console.log("[ipc] delete-purchase-bill called with id:", billId);
    const result = await db.deletePurchaseBill(billId);
    console.log("[ipc] delete-purchase-bill deleted id:", billId);
    return { success: true, message: "Purchase bill deleted", data: result };
  } catch (err) {
    console.error("[ipc] delete-purchase-bill error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// ========== AUTHENTICATION IPC HANDLERS ==========

// IPC: check-owner-exists - check if owner account exists
ipcMain.handle("check-owner-exists", async (event) => {
  try {
    const exists = await db.ownerExists();
    console.log("[ipc] check-owner-exists:", exists);
    return { success: true, data: { exists } };
  } catch (err) {
    console.error("[ipc] check-owner-exists error:", err);
    return { success: false, message: err.message, data: { exists: false } };
  }
});

// IPC: verify-owner-exists - verify specific owner exists by username (session restoration)
ipcMain.handle("verify-owner-exists", async (event, username) => {
  try {
    console.log("[ipc] verify-owner-exists called for username:", username);
    const owner = await db.verifyOwnerByUsername(username);
    const exists = owner !== null;
    console.log(
      "[ipc] verify-owner-exists:",
      exists ? "verified" : "not found",
    );
    return { success: true, data: { exists, owner: owner || null } };
  } catch (err) {
    console.error("[ipc] verify-owner-exists error:", err);
    return {
      success: false,
      message: err.message,
      data: { exists: false, owner: null },
    };
  }
});

// IPC: register-owner - create new owner account
ipcMain.handle(
  "register-owner",
  async (event, username, email, password, firstName, lastName) => {
    try {
      console.log("[ipc] register-owner called for username:", username);
      const owner = await db.registerOwner(
        username,
        email,
        password,
        firstName,
        lastName,
      );
      console.log("[ipc] register-owner successful");
      return { success: true, data: owner };
    } catch (err) {
      console.error("[ipc] register-owner error:", err);
      return { success: false, message: err.message, data: null };
    }
  },
);

// IPC: login-owner - authenticate owner with username/email and password
ipcMain.handle("login-owner", async (event, username, password) => {
  try {
    console.log("[ipc] login-owner called for username:", username);
    const owner = await db.loginOwner(username, password);
    console.log("[ipc] login-owner successful");
    return { success: true, data: owner };
  } catch (err) {
    console.error("[ipc] login-owner error:", err);
    return {
      success: false,
      message: err.message || "Login failed",
      data: null,
    };
  }
});

// IPC: get-owner - get current owner information
ipcMain.handle("get-owner", async (event) => {
  try {
    const owner = await db.getOwner();
    console.log("[ipc] get-owner:", owner ? owner.username : "none");
    return { success: true, data: owner };
  } catch (err) {
    console.error("[ipc] get-owner error:", err);
    return { success: false, message: err.message, data: null };
  }
});

// IPC: reset-password-recovery - DISABLED (Admin Recovery Code removed)
// Recovery code functionality has been removed from the system

// ========== DATABASE BACKUP/RESTORE IPC HANDLERS ==========

// IPC: backup-database - Manual backup of SQLite database
ipcMain.handle("backup-database", async (event) => {
  try {
    console.log("[ipc] backup-database triggered");
    const userDataPath = app.getPath("userData");
    const dbPath = path.join(userDataPath, "electrical_store.db");

    // Check if database file exists
    if (!fs.existsSync(dbPath)) {
      throw new Error("Database file not found");
    }

    // Generate default filename with current date
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const defaultFilename = `electrical_store_backup_${dateStr}.db`;

    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Backup Database",
      defaultPath: defaultFilename,
      filters: [
        { name: "SQLite Database", extensions: ["db"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || !result.filePath) {
      console.log("[ipc] backup-database canceled by user");
      return { success: false, message: "Backup cancelled" };
    }

    // Copy database file to selected location
    await new Promise((resolve, reject) => {
      fs.copyFile(dbPath, result.filePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log("[ipc] backup-database successful:", result.filePath);
    return {
      success: true,
      message: `Database backed up to ${result.filePath}`,
    };
  } catch (err) {
    console.error("[ipc] backup-database error:", err);
    return { success: false, message: err.message };
  }
});

// IPC: restore-database - Restore database from backup file
ipcMain.handle("restore-database", async (event) => {
  try {
    console.log("[ipc] restore-database triggered");
    const userDataPath = app.getPath("userData");
    const dbPath = path.join(userDataPath, "electrical_store.db");

    // Show open dialog to select backup file
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Restore Database",
      filters: [
        { name: "SQLite Database", extensions: ["db"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || !result.filePaths.length) {
      console.log("[ipc] restore-database canceled by user");
      return { success: false, message: "Restore cancelled" };
    }

    const backupPath = result.filePaths[0];

    // Verify backup file exists
    if (!fs.existsSync(backupPath)) {
      throw new Error("Selected backup file not found");
    }

    // Close database connection before restore
    console.log("[ipc] closing database connection for restore");
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
      console.warn("[ipc] error closing database:", closeErr);
    }

    // Replace current database with backup
    await new Promise((resolve, reject) => {
      fs.copyFile(backupPath, dbPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log("[ipc] restore-database successful, relaunching app");

    // Relaunch application to reinitialize database
    app.relaunch();
    app.exit(0);

    return { success: true, message: "Database restored, app will restart" };
  } catch (err) {
    console.error("[ipc] restore-database error:", err);
    return { success: false, message: err.message };
  }
});

// Receive renderer-side error logs forwarded from preload
ipcMain.on("renderer-error", (event, info) => {
  console.error("[renderer-error] forwarded from renderer:", info);
});

// App lifecycle
app.whenReady().then(async () => {
  // Initialize database before creating window
  try {
    await db.initializeDatabase();
    console.log("[electron] Database initialized successfully at app startup");

    // Fix any existing invoices with incorrect totals
    const fixResult = db.recalculateInvoiceTotals();
    if (fixResult.fixed > 0) {
      console.log(
        "[electron] Recalculated invoice totals:",
        fixResult.fixed,
        "invoices fixed",
      );
    }
  } catch (err) {
    console.error("[electron] Failed to initialize database:", err);
  }

  // Create main application window
  console.log("[electron] Creating main application window...");
  createWindow();

  createMenu();
});

app.on("window-all-closed", async () => {
  // Auto-backup database before exit
  try {
    const userDataPath = app.getPath("userData");
    const dbPath = path.join(userDataPath, "electrical_store.db");
    const backupsDir = path.join(userDataPath, "backups");

    if (fs.existsSync(dbPath)) {
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, "-").split("Z")[0];
      const backupFilename = `auto_backup_${timestamp}.db`;
      const backupPath = path.join(backupsDir, backupFilename);

      await new Promise((resolve, reject) => {
        fs.copyFile(dbPath, backupPath, (err) => {
          if (err) {
            console.error("[auto-backup] Failed to create backup:", err);
            reject(err);
          } else {
            console.log("[auto-backup] Created backup:", backupPath);
            resolve();
          }
        });
      });

      const files = fs
        .readdirSync(backupsDir)
        .filter((file) => file.startsWith("auto_backup_"))
        .map((file) => ({
          name: file,
          path: path.join(backupsDir, file),
          time: fs.statSync(path.join(backupsDir, file)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > 7) {
        for (let i = 7; i < files.length; i++) {
          try {
            fs.unlinkSync(files[i].path);
            console.log("[auto-backup] Deleted old backup:", files[i].name);
          } catch (err) {
            console.warn("[auto-backup] Failed to delete old backup:", err);
          }
        }
      }
    }
  } catch (err) {
    console.error("[auto-backup] Error during auto-backup:", err);
  }

  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
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
