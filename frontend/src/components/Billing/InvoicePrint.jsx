import React from 'react';
import './InvoicePrint.css';

/**
 * InvoicePrint Component - Medical Shop Invoice
 * 
 * IMPORTANT ARCHITECTURE NOTES:
 * ─────────────────────────────────────────────────────
 * 
 * This component is a PURE PRESENTATION COMPONENT:
 * • No hooks (no useState, useEffect, etc.)
 * • No API calls
 * • Only receives props: invoice, shop
 * • Renders static HTML that can be printed
 * 
 * Why no hooks or API calls:
 * • Data is already fetched in InvoiceDetail.jsx
 * • Fetching here would cause race conditions
 * • Extra API calls waste bandwidth
 * • Print timing is unpredictable
 * 
 * How printing works:
 * 1. Both screen and print views are rendered together
 * 2. Print view is hidden on screen via CSS (display: none)
 * 3. When user clicks "Print", window.print() is called
 * 4. Browser enters print mode (@media print kicks in)
 * 5. Print CSS hides everything except .invoice-print
 * 6. User sees the half-A4 invoice layout
 * 7. User clicks print or cancel in browser dialog
 * 8. Normal page returns
 * 
 * Why this is correct:
 * ✓ No duplicate data fetching
 * ✓ No state management needed
 * ✓ Simpler code, fewer bugs
 * ✓ Consistent data (uses same invoice object)
 * ✓ Browser handles print mode, not JavaScript
 * ✓ Works with browser's native print styling
 */

/**
 * Convert number to words (e.g., 1250.50 → "One Thousand Two Hundred Fifty Rupees Fifty Paise Only")
 * Used for legal invoice compliance
 */
const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertHundreds = (n) => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 > 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 > 0 ? ' ' + convertHundreds(n % 100) : '');
  };

  if (num === 0) return 'Zero';

  const [rupees, paise] = num.toFixed(2).split('.');
  const rupeesNum = parseInt(rupees);

  let result = '';
  if (rupeesNum >= 10000000) {
    const crores = Math.floor(rupeesNum / 10000000);
    result += convertHundreds(crores) + ' Crore ';
  }
  if ((rupeesNum % 10000000) >= 100000) {
    const lakhs = Math.floor((rupeesNum % 10000000) / 100000);
    result += convertHundreds(lakhs) + ' Lakh ';
  }
  if ((rupeesNum % 100000) >= 1000) {
    const thousands = Math.floor((rupeesNum % 100000) / 1000);
    result += convertHundreds(thousands) + ' Thousand ';
  }
  if ((rupeesNum % 1000) > 0) {
    result += convertHundreds(rupeesNum % 1000);
  }

  result = result.trim() + ' Rupees';
  if (parseInt(paise) > 0) {
    result += ' ' + convertHundreds(parseInt(paise)) + ' Paise';
  }

  return result + ' Only';
};

const InvoicePrint = ({ invoice, shop }) => {
  // Guard: Only render if we have required data
  if (!invoice || !shop) return null;

  // Format expiry date as MM/YY
  const formatExpiry = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return parts[1] + '/' + parts[2].substring(0, 2);
    }
    return dateStr;
  };

  // Calculate item-level totals
  const subtotal = (invoice.items || []).reduce((sum, item) => {
    const itemTotal = parseFloat(item.subtotal) || 0;
    return item.is_return ? sum - itemTotal : sum + itemTotal;
  }, 0);

  // Item-level discounts
  const itemDiscountAmount = (invoice.items || []).reduce((sum, item) => {
    const itemDiscount = (parseFloat(item.subtotal || 0) * parseFloat(item.discount_percent || 0)) / 100;
    return item.is_return ? sum - itemDiscount : sum + itemDiscount;
  }, 0);

  // Invoice-level discount (percentage-based)
  const invoiceLevelDiscountPercent = parseFloat(invoice.discount_percent || 0);
  const invoiceLevelDiscountAmount = (subtotal * invoiceLevelDiscountPercent) / 100;

  // Total discount = item-level + invoice-level
  const totalDiscountAmount = itemDiscountAmount + invoiceLevelDiscountAmount;

  const taxableAmount = subtotal - totalDiscountAmount;

  // Calculate GST by item (CGST + SGST split 50-50)
  let cgstByRate = {};
  let sgstByRate = {};

  (invoice.items || []).forEach(item => {
    const gstRate = parseFloat(item.gst_percent || 0);
    if (gstRate > 0) {
      const itemSubtotal = parseFloat(item.subtotal || 0);
      const itemDiscount = (itemSubtotal * parseFloat(item.discount_percent || 0)) / 100;
      let itemTaxable = itemSubtotal - itemDiscount;
      if (item.is_return) {
        itemTaxable = -itemTaxable;
      }
      const gstAmount = (itemTaxable * gstRate) / 100;
      const cgstAmountPer = gstAmount / 2;
      const sgstAmountPer = gstAmount / 2;
      cgstByRate[gstRate] = (cgstByRate[gstRate] || 0) + cgstAmountPer;
      sgstByRate[gstRate] = (sgstByRate[gstRate] || 0) + sgstAmountPer;
    }
  });

  const cgstAmount = Object.values(cgstByRate).reduce((a, b) => a + b, 0);
  const sgstAmount = Object.values(sgstByRate).reduce((a, b) => a + b, 0);

  const grandTotal = taxableAmount + cgstAmount + sgstAmount;
  const amountInWords = grandTotal > 0 ? numberToWords(Math.round(grandTotal)) : 'Zero';

  const invoiceDate = new Date(invoice.created_at);
  const dateStr = `${String(invoiceDate.getDate()).padStart(2, '0')}/${String(invoiceDate.getMonth() + 1).padStart(2, '0')}/${invoiceDate.getFullYear()}`;

  const isWholesale = invoice.buyer_store_name || invoice.buyer_address || invoice.buyer_phone || invoice.buyer_dl_number;

  const itemsPerPage = 12;
  const itemPages = [];
  for (let i = 0; i < (invoice.items || []).length; i += itemsPerPage) {
    itemPages.push((invoice.items || []).slice(i, i + itemsPerPage));
  }

  return (
    <div className="invoice-print thermal-invoice">
      {/* ═══════════════════════════════════════════════════════════
          THERMAL INVOICE HEADER - Half A4 Format (148mm width)
          ═══════════════════════════════════════════════════════════ */}
      <div className="thermal-header">
        <div className="thermal-header-wrapper" style={{ display: 'flex', justifyContent: 'space-between', gap: '2mm' }}>
          <div className="thermal-header-left" style={{ width: '48%', maxWidth: '48%', wordBreak: 'break-word', fontSize: '7px', lineHeight: '1.4' }}>
            <div className="thermal-shop-name" style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '1px' }}>{shop.shop_name || shop.name || 'MEDICAL STORE'}</div>
            <div className="thermal-shop-details" style={{ fontSize: '7px', lineHeight: '1.3', margin: '0' }}>
              {shop.address && <div style={{ maxWidth: '100%', wordBreak: 'break-word' }}>{shop.address}</div>}
              {shop.phone && <div>Ph.No.: {shop.phone}</div>}
              {shop.dl_number && <div>D.L.No.: {shop.dl_number}</div>}
              {shop.gst_number && <div>GSTIN: {shop.gst_number}</div>}
            </div>
          </div>

          <div className="thermal-header-right" style={{ width: '48%', maxWidth: '48%', textAlign: 'right', wordBreak: 'break-word', fontSize: '7px', lineHeight: '1.4' }}>
            <div style={{ fontSize: '7px', lineHeight: '1.3' }}>
              <div><span style={{ fontWeight: 'bold' }}>Bill To:</span> <span>{invoice.customer_name}</span></div>
              {invoice.customer_phone && <div style={{ marginTop: '2px' }}><span style={{ fontWeight: 'bold' }}>Ph.No:</span> <span>{invoice.customer_phone}</span></div>}
              {invoice.customer_dl_number && invoice.customer_dl_number.trim() !== '' && (
                <div style={{ marginTop: '2px' }}><span style={{ fontWeight: 'bold' }}>DL No:</span> <span style={{ maxWidth: '100%', wordBreak: 'break-word', display: 'inline-block' }}>{invoice.customer_dl_number}</span></div>
              )}
              {invoice.customer_address && invoice.customer_address.trim() !== '' && (
                <div style={{ marginTop: '2px', maxWidth: '100%', wordBreak: 'break-word' }}>
                  <span style={{ fontWeight: 'bold' }}>Address:</span> <span style={{ display: 'block', marginTop: '1px' }}>{invoice.customer_address}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TAX INVOICE Title - Centered, between address blocks and invoice meta */}
        <div style={{ fontSize: '10px', fontWeight: 'bold', padding: '2px 0', margin: '2px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000', textAlign: 'center', textTransform: 'uppercase' }}>TAX INVOICE</div>

        {/* Invoice Meta - Two column layout */}
        <table className="thermal-invoice-meta" style={{ fontSize: '7.5px' }}>
          <tbody>
            <tr>
              <td className="meta-label">Invoice No:</td>
              <td className="meta-value">{invoice.id}</td>
              <td className="meta-label" style={{ paddingLeft: '10px' }}>Date:</td>
              <td className="meta-value">{dateStr}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Customer block moved to header; original block removed to avoid duplication */}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 3: ITEMS TABLE - Thermal printer optimized
          Column Order: S.No | Qty | Product Name | Batch | Exp | HSN | MRP | Rate | Disc% | GST% | Amount
          ═══════════════════════════════════════════════════════════ */}
      <table className="thermal-items-table">
        <thead>
          <tr className="thermal-items-header">
            <th className="thermal-col-sno">Sn.</th>
            <th className="thermal-col-qty">Qty</th>
            <th className="thermal-col-product">Product</th>
            <th className="thermal-col-batch">Batch</th>
            <th className="thermal-col-exp">Exp.</th>
            <th className="thermal-col-hsn">HSN</th>
            <th className="thermal-col-mrp">MRP</th>
            <th className="thermal-col-rate">Rate</th>
            <th className="thermal-col-disc">Disc%</th>
            <th className="thermal-col-gst">GST%</th>
            <th className="thermal-col-amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(invoice.items || []).map((item, idx) => {
            const itemNumber = idx + 1;
            const itemQty = parseFloat(item.quantity || 0);
            const itemSubtotal = parseFloat(item.subtotal || 0);
            const itemDiscount = (itemSubtotal * parseFloat(item.discount_percent || 0)) / 100;
            const itemTaxable = itemSubtotal - itemDiscount;
            const itemGst = (itemTaxable * parseFloat(item.gst_percent || 0)) / 100;
            // For returns, negate the amount (shows as credit/refund)
            const itemTotal = item.is_return ? -(itemTaxable + itemGst) : (itemTaxable + itemGst);

            return (
              <tr key={item.id || idx} className={`thermal-item-row ${item.is_return ? 'thermal-return-item' : ''}`}>
                <td className="thermal-col-sno">{itemNumber}{item.is_return ? 'R' : ''}</td>
                <td className="thermal-col-qty">{item.is_return ? '-' : ''}{itemQty}</td>
                <td className="thermal-col-product">
                  <div className="product-name">
                    {item.product_name && String(item.product_name).trim()}
                    {item.is_return && <span className="return-badge"> [RETURN]</span>}
                  </div>
                  {item.is_return && item.return_reason && (
                    <div className="return-reason" style={{ fontSize: '0.7em', color: '#666' }}>
                      ({item.return_reason})
                    </div>
                  )}
                </td>
                <td className="thermal-col-batch">{item.batch_number || '-'}</td>
                <td className="thermal-col-exp" style={{ whiteSpace: 'nowrap', minWidth: '34px', width: '34px', fontSize: '7px', padding: '1.5px 2px' }}>{formatExpiry(item.expiry_date)}</td>
                <td className="thermal-col-hsn">{item.hsn_code || '-'}</td>
                <td className="thermal-col-mrp">₹{parseFloat(item.mrp || 0).toFixed(2)}</td>
                <td className="thermal-col-rate">₹{parseFloat(item.selling_rate || 0).toFixed(2)}</td>
                <td className="thermal-col-disc">{parseFloat(item.discount_percent || 0).toFixed(1)}</td>
                <td className="thermal-col-gst">{parseFloat(item.gst_percent || 0).toFixed(1)}</td>
                <td className={`thermal-col-amount ${item.is_return ? 'return-amount' : ''}`}>
                  ₹{Math.abs(itemTotal).toFixed(2)}{item.is_return ? ' CR' : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 4: THERMAL FOOTER - Summary and Totals
          ═══════════════════════════════════════════════════════════ */}
      <div className="thermal-footer">
        <table className="thermal-summary-table">
          <tbody>
            <tr className="thermal-summary-row">
              <td className="thermal-summary-label">Subtotal:</td>
              <td className="thermal-summary-value">₹{subtotal.toFixed(2)}</td>
            </tr>

            {totalDiscountAmount > 0 && (
              <tr className="thermal-summary-row">
                <td className="thermal-summary-label">Discount:</td>
                <td className="thermal-summary-value discount-value">-₹{totalDiscountAmount.toFixed(2)}</td>
              </tr>
            )}

            <tr className="thermal-summary-row">
              <td className="thermal-summary-label">Taxable Amount:</td>
              <td className="thermal-summary-value">₹{taxableAmount.toFixed(2)}</td>
            </tr>

            {/* CGST */}
            {cgstAmount > 0 && (
              <tr className="thermal-summary-row">
                <td className="thermal-summary-label">CGST:</td>
                <td className="thermal-summary-value">₹{cgstAmount.toFixed(2)}</td>
              </tr>
            )}

            {/* SGST */}
            {sgstAmount > 0 && (
              <tr className="thermal-summary-row">
                <td className="thermal-summary-label">SGST:</td>
                <td className="thermal-summary-value">₹{sgstAmount.toFixed(2)}</td>
              </tr>
            )}

            <tr className="thermal-summary-total">
              <td className="thermal-summary-label-total">GRAND TOTAL:</td>
              <td className="thermal-summary-value-total">₹{grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Amount in Words */}
        <div className="thermal-amount-in-words">
          <strong>Amt in Words:</strong> {amountInWords}
        </div>

        {/* Terms & Conditions */}
        <div className="thermal-terms-conditions">
          <strong>Terms & Conditions:</strong>
          <p>• Goods once sold will not be taken back or exchanged.</p>
          <p>• Bills not paid due date will attract 24% interest.</p>
        </div>

        {/* Footer Text */}
        <div className="thermal-footer-text">
          Thank You - Visit Again!
        </div>
      </div>
    </div>
  );
};

export default InvoicePrint;
