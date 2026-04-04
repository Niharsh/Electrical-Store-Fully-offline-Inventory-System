// InvoicePrint.jsx
import React from 'react';
import './InvoicePrint.css';

const ITEMS_PER_PAGE = 18;

const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
    'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
    'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertHundreds = (n) => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100)
      return tens[Math.floor(n / 10)] + (n % 10 > 0 ? ' ' + ones[n % 10] : '');
    return (
      ones[Math.floor(n / 100)] +
      ' Hundred' +
      (n % 100 > 0 ? ' ' + convertHundreds(n % 100) : '')
    );
  };

  if (!num || num === 0) return 'Zero Rupees Only';

  const [rupeesPart, paisePart] = num.toFixed(2).split('.');
  const rupeesNum = parseInt(rupeesPart);

  let result = '';
  if (rupeesNum >= 10000000)
    result += convertHundreds(Math.floor(rupeesNum / 10000000)) + ' Crore ';
  if ((rupeesNum % 10000000) >= 100000)
    result += convertHundreds(Math.floor((rupeesNum % 10000000) / 100000)) + ' Lakh ';
  if ((rupeesNum % 100000) >= 1000)
    result += convertHundreds(Math.floor((rupeesNum % 100000) / 1000)) + ' Thousand ';
  if (rupeesNum % 1000 > 0)
    result += convertHundreds(rupeesNum % 1000);

  result = result.trim() + ' Rupees';
  if (parseInt(paisePart) > 0)
    result += ' ' + convertHundreds(parseInt(paisePart)) + ' Paise';

  return result + ' Only';
};

/* ─────────────────────────────────────────────────────────────────
   SHARED: Items table (thead + rows + tfoot)
───────────────────────────────────────────────────────────────── */
const ItemsTable = ({ items, startIndex, pageQty, pageSubtotal, isLastPage }) => (
  <table className="inv-items">
    <thead>
      <tr className="inv-items-head">
        <th className="ic-sno">S.No</th>
        <th className="ic-desc">Description of Goods</th>
        <th className="ic-hsn">HSN</th>
        <th className="ic-qty">Qty</th>
        <th className="ic-unit">UNIT</th>
        <th className="ic-mrp">LIST PRICE</th>
        <th className="ic-rate">PRICE</th>
        <th className="ic-disc">DISC%</th>
        <th className="ic-amt">AMOUNT</th>
      </tr>
    </thead>
    <tbody>
      {items.map((item, idx) => {
        const s        = parseFloat(item.subtotal || 0);
        const itemSign = item.is_return ? -1 : 1;
        const amt      = itemSign * s;

        return (
          <tr
            key={item.id || idx}
            className={item.is_return ? 'inv-return-row' : ''}
          >
            <td className="ic-sno">
              {startIndex + idx + 1}{item.is_return ? 'R' : ''}
            </td>
            <td className="ic-desc">
              {item.product_name}
              {item.is_return && (
                <span className="inv-return-badge"> [RETURN]</span>
              )}
            </td>
            <td className="ic-hsn">{item.hsn_code || '-'}</td>
            <td className="ic-qty">
              {item.is_return ? '-' : ''}
              {parseFloat(item.quantity || 0)}
            </td>
            <td className="ic-unit">{item.unit || 'PCS'}</td>
            <td className="ic-mrp">
              {parseFloat(item.mrp || 0).toFixed(2)}
            </td>
            <td className="ic-rate">
              {parseFloat(item.selling_rate || 0).toFixed(2)}
            </td>
            <td className="ic-disc">
              {parseFloat(item.discount_percent || 0).toFixed(1)}
            </td>
            <td className="ic-amt">
              {Math.abs(amt).toFixed(2)}
              {item.is_return ? ' CR' : ''}
            </td>
          </tr>
        );
      })}
    </tbody>

    <tfoot>
      <tr className="inv-items-foot">
        <td colSpan={3} className="inv-foot-label">TOTAL QTY.</td>
        <td className="ic-qty inv-foot-qty">{pageQty}</td>
        <td colSpan={3} />
        <td className="inv-foot-subtotal-label">SUB TOTAL.</td>
        <td className="ic-amt inv-foot-subtotal-val">
          {pageSubtotal.toFixed(2)}
        </td>
      </tr>
    </tfoot>
  </table>
);

/* ─────────────────────────────────────────────────────────────────
   SHARED: Continuation header (used on page 2+)
───────────────────────────────────────────────────────────────── */
const ContinuationHeader = ({ shop, invoice, pageNum, totalPages }) => (
  <tr>
    <td colSpan={3} className="inv-continuation-header">
      {/* ↑ Need inner div for flexbox — td ignores display:flex */}
      <div className="inv-cont-inner">
        <div className="inv-cont-left">
          <span className="inv-cont-shopname">
            {shop.shop_name || shop.name || 'YOUR COMPANY'}
          </span>
          <span className="inv-cont-invno">
            | Invoice No: {invoice.invoice_number || `INV-${invoice.id}`}
          </span>
        </div>
        <div className="inv-cont-right">
          Page {pageNum} of {totalPages}
        </div>
      </div>
    </td>
  </tr>
);

/* ─────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────── */
const InvoicePrint = ({ invoice, shop, qrDataUrl }) => {
  if (!invoice || !shop) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  /* ── Totals ─────────────────────────────────────────────────── */
  const postDiscountSubtotal = (invoice.items || []).reduce((sum, item) => {
    const v = parseFloat(item.subtotal || 0);
    return item.is_return ? sum - v : sum + v;
  }, 0);

  const taxableAmount = parseFloat(postDiscountSubtotal.toFixed(2));
  const tax_type      = invoice.tax_type || 'gst';

  let cgstByRate = {};
  let sgstByRate = {};
  let igstByRate = {};

  (invoice.items || []).forEach((item) => {
    if (tax_type === 'none') return;
    const gstRate = parseFloat(item.gst_percent || 0);
    if (gstRate > 0) {
      const s       = parseFloat(item.subtotal || 0);
      const taxable = item.is_return ? -s : s;
      if (tax_type === 'igst') {
        igstByRate[gstRate] = (igstByRate[gstRate] || 0) + (taxable * gstRate) / 100;
      } else {
        const half = (taxable * gstRate) / 200;
        cgstByRate[gstRate] = (cgstByRate[gstRate] || 0) + half;
        sgstByRate[gstRate] = (sgstByRate[gstRate] || 0) + half;
      }
    }
  });

  const cgstAmount   = Object.values(cgstByRate).reduce((a, b) => a + b, 0);
  const sgstAmount   = Object.values(sgstByRate).reduce((a, b) => a + b, 0);
  const igstAmount   = Object.values(igstByRate).reduce((a, b) => a + b, 0);
  const grandTotal   = tax_type === 'none'
    ? taxableAmount
    : taxableAmount + cgstAmount + sgstAmount + igstAmount;
  const amountInWords = numberToWords(Math.round(grandTotal));

  const totalQty = (invoice.items || []).reduce(
    (s, i) => s + (parseFloat(i.quantity) || 0), 0
  );

  const invoiceDate = formatDate(invoice.created_at);

  /* ── Bill To / Ship To ──────────────────────────────────────── */
  const billName    = invoice.bill_to_name    || invoice.customer_name    || '';
  const billPhone   = invoice.bill_to_phone   || invoice.customer_phone   || '';
  const billAddress = invoice.bill_to_address || invoice.customer_address || '';
  const billGstin   = invoice.bill_to_gstin   || invoice.buyer_gstin      || '';
  const billState   = invoice.bill_to_state   || invoice.customer_state   || '';
  const shipName    = invoice.ship_to_name    || billName    || '';
  const shipPhone   = invoice.ship_to_phone   || billPhone   || '';
  const shipAddress = invoice.ship_to_address || billAddress || '';
  const shipGstin   = invoice.ship_to_gstin   || billGstin   || '';
  const shipState   = invoice.ship_to_state   || billState   || '';

  /* ── Pagination ─────────────────────────────────────────────── */
  const allItems   = invoice.items || [];
  const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE) || 1;

  // Build array of page-item chunks
  const pages = [];
  for (let p = 0; p < totalPages; p++) {
    pages.push(allItems.slice(p * ITEMS_PER_PAGE, (p + 1) * ITEMS_PER_PAGE));
  }

  /* ── Per-page calculations ──────────────────────────────────── */
  const getPageQty = (items) =>
    items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);

  const getPageSubtotal = (items) =>
    items.reduce((s, i) => {
      const v = parseFloat(i.subtotal || 0);
      return i.is_return ? s - v : s + v;
    }, 0);

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <div className="invoice-print-wrapper">

      {pages.map((pageItems, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage  = pageIndex === totalPages - 1;
        const pageNum     = pageIndex + 1;
        const startIndex  = pageIndex * ITEMS_PER_PAGE;
        const pageQty     = getPageQty(pageItems);
        const pageSubtotal = getPageSubtotal(pageItems);

        return (
          <div
            key={pageIndex}
            className="invoice-print a4-invoice"
            style={{ pageBreakAfter: isLastPage ? 'auto' : 'always' }}
          >
            <table className="inv-root">
              <tbody>

                {/* ══ PAGE NUMBER (every page, top-right) ══════════ */}
                <tr>
                  <td colSpan={3} className="inv-page-number-row">
                    Page {pageNum} of {totalPages}
                  </td>
                </tr>

                {/* ══ FIRST PAGE: Full header ═══════════════════════ */}
                {isFirstPage && (
                  <>
                    {/* Shop header */}
                    <tr>
                      <td className="inv-stub" />
                      <td className="inv-header-center">
                        <div className="inv-title-tax">TAX INVOICE</div>
                        <div className="inv-company-name">
                          {shop.shop_name || shop.name || 'YOUR COMPANY'}
                        </div>
                        {(shop.owner_name || shop.gst_number) && (
                          <div className="inv-company-sub">
                            {shop.owner_name && (
                              <span>PROPRIETOR: {shop.owner_name}</span>
                            )}
                            {shop.owner_name && shop.gst_number && (
                              <span className="inv-header-separator"> | </span>
                            )}
                            {shop.gst_number && (
                              <span>GSTIN: {shop.gst_number}</span>
                            )}
                          </div>
                        )}
                        {shop.address && (
                          <div className="inv-company-addr">{shop.address}</div>
                        )}
                        {shop.phone && (
                          <div className="inv-company-sub">Ph.No.: {shop.phone}</div>
                        )}
                      </td>
                      <td className="inv-header-qr">
                        {qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt="QR Code"
                            style={{
                              width: '110px', height: '110px',
                              objectFit: 'contain', display: 'block',
                              margin: '0 auto',
                            }}
                          />
                        ) : (
                          <div className="inv-qr-empty">(QR Code)</div>
                        )}
                      </td>
                    </tr>

                    {/* Invoice No + Date */}
                    <tr>
                      <td className="inv-meta-label">Invoice No:</td>
                      <td className="inv-meta-value">
                        {invoice.invoice_number || `INV-${invoice.id}`}
                      </td>
                      <td className="inv-meta-value inv-date-right">
                        <span className="inv-date-label">Invoice Date:&nbsp;</span>
                        <span className="inv-date-value">{invoiceDate}</span>
                      </td>
                    </tr>

                    {/* Place of Supply + E-Way Bill */}
                    <tr>
                      <td className="inv-meta-label">Place of Supply:</td>
                      <td className="inv-meta-value">
                        {invoice.place_of_supply || ''}
                      </td>
                      <td className="inv-meta-value">
                        <span className="inv-inline-label">E-Way Bill No:&nbsp;</span>
                        {invoice.eway_bill_no || ''}
                      </td>
                    </tr>

                    {/* Bill To / Ship To headers */}
                    <tr>
                      <td className="inv-stub" />
                      <td className="inv-section-header">Bill To</td>
                      <td className="inv-section-header">SHIP TO</td>
                    </tr>

                    {/* Name */}
                    <tr>
                      <td className="inv-field-label">Name:</td>
                      <td className="inv-field-value">{billName}</td>
                      <td className="inv-field-value">{shipName}</td>
                    </tr>

                    {/* Phone */}
                    <tr>
                      <td className="inv-field-label">Phone Number:</td>
                      <td className="inv-field-value">{billPhone || '-'}</td>
                      <td className="inv-field-value">{shipPhone || '-'}</td>
                    </tr>

                    {/* Address */}
                    <tr>
                      <td className="inv-field-label">Address:</td>
                      <td className="inv-field-value inv-address">{billAddress}</td>
                      <td className="inv-field-value inv-address">{shipAddress}</td>
                    </tr>

                    {/* GSTIN */}
                    <tr>
                      <td className="inv-field-label">GSTIN:</td>
                      <td className="inv-field-value">{billGstin}</td>
                      <td className="inv-field-value">{shipGstin}</td>
                    </tr>

                    {/* State */}
                    <tr>
                      <td className="inv-field-label">State:</td>
                      <td className="inv-field-value">{billState}</td>
                      <td className="inv-field-value">{shipState}</td>
                    </tr>
                  </>
                )}

                {/* ══ PAGE 2+: Compact continuation header ═════════ */}
                {!isFirstPage && (
                  <ContinuationHeader
                    shop={shop}
                    invoice={invoice}
                    pageNum={pageNum}
                    totalPages={totalPages}
                  />
                )}

                {/* ══ ITEMS TABLE ═══════════════════════════════════ */}
                <tr>
                  <td colSpan={3} className="inv-items-wrapper">
                    <ItemsTable
                      items={pageItems}
                      startIndex={startIndex}
                      pageQty={pageQty}
                      pageSubtotal={pageSubtotal}
                      isLastPage={isLastPage}
                    />
                  </td>
                </tr>

                {/* ══ NOT LAST PAGE: "Continued" notice ════════════ */}
                {!isLastPage && (
                  <tr>
                    <td colSpan={3} className="inv-continued-notice">
                      *** Continued on Next Page ***
                    </td>
                  </tr>
                )}

                {/* ══ LAST PAGE: Financial summary ═════════════════ */}
                {isLastPage && (
                  <>
                    {/* Subtotal */}
                    <tr>
                      <td className="inv-sum-label">Subtotal:</td>
                      <td className="inv-sum-value" colSpan={2}>
                        ₹{postDiscountSubtotal.toFixed(2)}
                      </td>
                    </tr>

                    {/* Taxable Amount */}
                    <tr>
                      <td className="inv-sum-label">Taxable Amount:</td>
                      <td className="inv-sum-value" colSpan={2}>
                        ₹{taxableAmount.toFixed(2)}
                      </td>
                    </tr>

                    {/* CGST */}
                    {tax_type === 'gst' && cgstAmount > 0 && (
                      <tr>
                        <td className="inv-sum-label">CGST:</td>
                        <td className="inv-sum-value" colSpan={2}>
                          ₹{cgstAmount.toFixed(2)}
                        </td>
                      </tr>
                    )}

                    {/* SGST */}
                    {tax_type === 'gst' && sgstAmount > 0 && (
                      <tr>
                        <td className="inv-sum-label">SGST:</td>
                        <td className="inv-sum-value" colSpan={2}>
                          ₹{sgstAmount.toFixed(2)}
                        </td>
                      </tr>
                    )}

                    {/* IGST */}
                    {tax_type === 'igst' && igstAmount > 0 && (
                      <tr>
                        <td className="inv-sum-label">IGST:</td>
                        <td className="inv-sum-value" colSpan={2}>
                          ₹{igstAmount.toFixed(2)}
                        </td>
                      </tr>
                    )}

                    {/* Grand Total */}
                    <tr className="inv-grand-total-row">
                      <td className="inv-grand-label">GRAND TOTAL:</td>
                      <td className="inv-grand-value" colSpan={2}>
                        ₹{grandTotal.toFixed(2)}
                      </td>
                    </tr>

                    {/* Amount in Words */}
                    <tr>
                      <td className="inv-words-cell" colSpan={3}>
                        <strong>Amt in Words:</strong>{' '}
                        <span className="inv-words-text">{amountInWords}</span>
                      </td>
                    </tr>

                    {/* Bank Details */}
                    <tr>
                      <td colSpan={3} style={{ padding: '6px 8px' }}>
                        <div style={{
                          fontWeight: 700, fontSize: '11px', marginBottom: '4px'
                        }}>
                          Bank Details:
                        </div>
                        <div style={{
                          display: 'flex', gap: '0px',
                          fontSize: '10.5px', marginTop: '4px'
                        }}>
                          {shop.bank_holder && (
                            <div style={{
                              paddingRight: '12px', marginRight: '12px',
                              borderRight: '1px solid #000'
                            }}>
                              <strong>A/c Holder:</strong> {shop.bank_holder}
                            </div>
                          )}
                          {shop.bank_name && (
                            <div style={{
                              paddingRight: '12px', marginRight: '12px',
                              borderRight: '1px solid #000'
                            }}>
                              <strong>Bank Name:</strong> {shop.bank_name}
                            </div>
                          )}
                          {shop.bank_account && (
                            <div style={{
                              paddingRight: '12px', marginRight: '12px',
                              borderRight: '1px solid #000'
                            }}>
                              <strong>A/c No:</strong> {shop.bank_account}
                            </div>
                          )}
                          {shop.bank_ifsc && (
                            <div>
                              <strong>IFSC:</strong> {shop.bank_ifsc}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Thank You */}
                    <tr>
                      <td className="inv-thankyou-cell" colSpan={3}>
                        Thank You - Visit Again!
                      </td>
                    </tr>
                  </>
                )}

              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

export default InvoicePrint;