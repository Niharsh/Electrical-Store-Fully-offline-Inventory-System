/**
 * PDF Parser for Indian GST Purchase Invoices
 * Extracts wholesale data: bill info, products, quantities, pricing
 */

const WHOLESALE_DISCOUNT = 0.48; // 48% discount → MRP = price / 0.52

/**
 * Extract wholesaler name from PDF text
 * Looks for the prominent ALL CAPS company name near the top
 */
function extractWholesalerName(text) {
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip header lines and known patterns
    if (
      !line ||
      line.includes("GSTIN") ||
      line.includes("TAX INVOICE") ||
      line.includes("PAN") ||
      line.includes("MSME") ||
      line.includes("Mfrs") ||
      line.includes("Works") ||
      line.includes("Head Office") ||
      line.includes("Mob") ||
      line.includes("E-mail") ||
      line.includes("Billed to") ||
      line.includes("Shipped to") ||
      line.includes("Invoice No") ||
      line.includes("Date of")
    ) {
      continue;
    }

    // Look for ALL CAPS company name (at least 3 chars, mostly letters)
    if (
      line.length > 2 &&
      /^[A-Z\s\-&]+$/.test(line) &&
      /[A-Z]{3,}/.test(line)
    ) {
      return line.trim();
    }
  }

  return "";
}

/**
 * Extract bill number from PDF text
 * Looks for "Invoice No." pattern
 */
function extractBillNumber(text) {
  const invoiceNoMatch = text.match(/Invoice\s+No\.?\s*:?\s*([^\s\n]+)/i);
  if (invoiceNoMatch) {
    return invoiceNoMatch[1].trim();
  }
  return "";
}

/**
 * Extract bill date from PDF text, convert DD-MM-YYYY to YYYY-MM-DD
 */
function extractBillDate(text) {
  const dateMatch = text.match(
    /Date\s+of\s+Invoice\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
  );
  if (dateMatch) {
    const dateStr = dateMatch[1];
    const parts = dateStr.split(/[-\/]/);

    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];

      return `${year}-${month}-${day}`;
    }
  }

  return new Date().toISOString().split("T")[0];
}

/**
 * Find the product table start line (contains headers like Description, HSN, Qty, Price)
 */
function findTableStart(lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();

    // Look for combined headers
    if (
      (line.includes("description") || line.includes("goods")) &&
      (line.includes("hsn") || line.includes("code")) &&
      (line.includes("qty") || line.includes("quantity"))
    ) {
      return i + 1; // Start from next line
    }
  }

  return -1;
}

/**
 * Check if a line is a footer keyword
 */
function isFooterLine(line) {
  const footerPatterns = [
    "Sub Total",
    "Grand Total",
    "IGST",
    "CGST",
    "SGST",
    "Freight",
    "Forwa",
    "Amount in Words",
    "Rounded Off",
    "Terms",
    "Bank",
    "Note",
    "Signature",
  ];

  return footerPatterns.some((pattern) => line.includes(pattern));
}

/**
 * Parse a single product row
 * Format: S.N. | Description | HSN | Pcs/Box | No.of Bag | Qty | Unit | Price | Amount
 */
function parseProductRow(line) {
  if (!/^\d+\./.test(line.trim())) return null;

  // Extract first 8-digit HSN code
  const hsnMatch = line.match(/(\d{8})/);
  if (!hsnMatch) return null;
  const hsnCode = hsnMatch[1];
  const hsnIndex = line.indexOf(hsnCode);

  // Product name = between serial number and HSN
  const productName = line
    .substring(0, hsnIndex)
    .replace(/^\s*\d+\.\s*/, "")
    .trim();
  if (!productName) return null;

  // Everything after HSN
  const afterHSN = line.substring(hsnIndex + hsnCode.length);

  // Find unit word
  const unitMatch = afterHSN.match(
    /(BOX|PCS|KGS|KG|NOS|MTR|PKT|SET|ROLL|PAIR|PC)/i,
  );
  if (!unitMatch) return null;
  const unitRaw = unitMatch[1].toUpperCase();
  const unit = unitRaw === "KGS" ? "KG" : unitRaw;
  const unitIndex = afterHSN.indexOf(unitMatch[0]);

  // beforeUnit: contains pcs_per_box + no_of_bag + qty all merged
  const beforeUnit = afterHSN.substring(0, unitIndex);

  // afterUnit: contains price and amount
  const afterUnit = afterHSN.substring(unitIndex + unitMatch[0].length);

  // KEY FIX: qty always ends in .00 and is at most 4 digits before decimal
  // e.g. "80020.00" → Pcs/Box=800, Qty=20.00
  // e.g. "500125.00" → Pcs/Box=500, NoBag=1, Qty=25.00
  // e.g. "240160.00" → Pcs/Box=240, NoBag=1, Qty=60.00
  // Strategy: match last decimal, then take only last 1-4 digits of integer part
  // Price = first decimal after unit
  const priceMatches = [...afterUnit.matchAll(/([\d,]+\.\d{2})/g)];
  if (!priceMatches.length) return null;
  const costPrice = parseFloat(priceMatches[0][1].replace(/,/g, ""));
  if (costPrice <= 0) return null;

  // Amount = last decimal after unit (always qty × price)
  const amountMatches = [...afterUnit.matchAll(/([\d,]+\.\d{2})/g)];
  if (amountMatches.length < 2) return null;
  const amount = parseFloat(
    amountMatches[amountMatches.length - 1][1].replace(/,/g, ""),
  );

  // Derive qty from amount ÷ price — 100% accurate, no guessing
  const quantity = parseFloat((amount / costPrice).toFixed(2));
  if (quantity <= 0) return null;

  return {
    product_name: productName,
    hsn_code: hsnCode,
    quantity,
    unit,
    cost_price: costPrice,
    selling_rate: costPrice,
    mrp: parseFloat((costPrice / (1 - WHOLESALE_DISCOUNT)).toFixed(2)),
  };
}
/**
 * Extract all products from PDF text
 */
function extractProducts(text) {
  const lines = text.split("\n");
  const products = [];

  const tableStartIdx = findTableStart(lines);
  if (tableStartIdx === -1) return products;

  for (let i = tableStartIdx; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) continue;
    if (isFooterLine(line)) break;

    // Only try lines starting with a serial number
    if (!/^\d+\./.test(line)) continue;

    const product = parseProductRow(line);
    if (product) products.push(product);
  }

  return products;
}

/**
 * Calculate confidence score (0-100)
 */
function calculateConfidence(result) {
  let score = 0;

  if (result.wholesaler_name) score += 20;
  if (result.bill_number) score += 20;
  if (result.bill_date) score += 10;
  if (result.products.length > 0) score += 30;

  // Bonus: if most products have HSN codes
  if (result.products.length > 0) {
    const productsWithHSN = result.products.filter((p) => p.hsn_code).length;
    if (productsWithHSN / result.products.length > 0.7) {
      score += 20;
    }
  }

  return Math.min(100, score);
}

/**
 * Main parser: extract all data from raw PDF text
 */
function parsePurchaseInvoice(rawText) {
  const result = {
    wholesaler_name: extractWholesalerName(rawText),
    bill_number: extractBillNumber(rawText),
    bill_date: extractBillDate(rawText),
    products: extractProducts(rawText),
  };

  result.confidence = calculateConfidence(result);

  return result;
}

module.exports = {
  parsePurchaseInvoice,
  WHOLESALE_DISCOUNT,
};
