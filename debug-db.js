const Database = require("better-sqlite3");
const path = require("path");
const os = require("os");

const dbPath = path.join(
  os.homedir(),
  "AppData",
  "Roaming",
  "Electron",
  "electrical_store.db",
);
console.log("Database Path:", dbPath);

try {
  const db = new Database(dbPath);

  console.log("\n===== PRODUCTS TABLE =====");
  const products = db
    .prepare("SELECT id, name, unit, product_type FROM products LIMIT 10")
    .all();
  products.forEach((p) => {
    const nameLen = p.name ? p.name.length : 0;
    console.log(
      `ID: ${p.id}, Name: '${p.name}' (len=${nameLen}), Unit: '${p.unit}', Type: '${p.product_type}'`,
    );
  });

  console.log("\n===== INVOICE_ITEMS TABLE (last 10) =====");
  const items = db
    .prepare(
      "SELECT id, product_id, product_name FROM invoice_items ORDER BY id DESC LIMIT 10",
    )
    .all();
  items.forEach((i) => {
    const nameLen = i.product_name ? i.product_name.length : 0;
    console.log(
      `ItemID: ${i.id}, ProdID: ${i.product_id}, ProductName: '${i.product_name}' (len=${nameLen})`,
    );
  });

  db.close();
  console.log("\nDone.");
} catch (err) {
  console.error("Error:", err.message);
  console.error(err.stack);
}
