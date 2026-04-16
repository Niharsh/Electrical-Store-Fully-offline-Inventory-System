const Database = require("better-sqlite3");
const path = require("path");
const { app } = require("electron").remote || require("electron");
const os = require("os");

// Get the electron app data path
const dbPath = path.join(
  os.homedir(),
  "AppData",
  "Roaming",
  "Electron",
  "electrical_store.db",
);

console.log("Database path:", dbPath);

try {
  const db = new Database(dbPath);

  // Check products table
  console.log("\n===== PRODUCTS TABLE (first 5) =====");
  const products = db
    .prepare("SELECT id, name, unit, product_type FROM products LIMIT 5")
    .all();
  console.table(products);

  // Check a specific product that appears in the invoice
  console.log('\n===== LOOKING FOR "8 WAY MOD/BOARD SQUARE" =====');
  const specific = db
    .prepare(
      "SELECT id, name, unit, product_type FROM products WHERE name LIKE ?",
    )
    .all("%8 WAY%");
  console.table(specific);

  // Check invoice_items with product_name
  console.log("\n===== RECENT INVOICE_ITEMS (last 3) =====");
  const items = db
    .prepare(
      "SELECT id, product_id, product_name, batch_number FROM invoice_items ORDER BY id DESC LIMIT 3",
    )
    .all();
  console.table(items);

  db.close();
  process.exit(0);
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
