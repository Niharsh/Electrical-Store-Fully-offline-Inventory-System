import React, { useState, useCallback } from 'react';

// ── Financial year helper ─────────────────────────────────────
const getCurrentFinancialYear = () => {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  return month >= 4
    ? { start: year,     end: year + 1 }
    : { start: year - 1, end: year     };
};

const getFinancialYearOptions = () => {
  const options = [];
  const current = getCurrentFinancialYear();
  for (let i = 0; i < 5; i++) {
    const s = current.start - i;
    options.push({ start: s, end: s + 1, label: `${s}-${String(s + 1).slice(-2)}` });
  }
  return options;
};

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n) => parseFloat(n || 0).toFixed(2);

// ── Main component ────────────────────────────────────────────
const HSNGSTReport = () => {

  // Filter state
  const fy      = getCurrentFinancialYear();
  const today   = new Date();

  const [filterType,   setFilterType]   = useState('month');   // 'month' | 'year' | 'financial'
  const [filterMonth,  setFilterMonth]  = useState(today.getMonth()); // 0-indexed
  const [filterYear,   setFilterYear]   = useState(today.getFullYear());
  const [filterFYStart,setFilterFYStart]= useState(fy.start);
  const [viewMode,     setViewMode]     = useState('tax_only'); // 'tax_only' | 'all'

  const [reportData,   setReportData]   = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [downloading,  setDownloading]  = useState(false);
  const [error,        setError]        = useState('');
  const [hasLoaded,    setHasLoaded]    = useState(false);

  // ── Date range from filters ───────────────────────────────
 const getDateRange = useCallback(() => {

  // ✅ FIX: Build date strings directly without using toISOString()
  // toISOString() converts to UTC which causes wrong dates in IST timezone
  // e.g. new Date(2026, 3, 1).toISOString() = '2026-03-31' in India ❌

  const pad = (n) => String(n).padStart(2, '0');

  if (filterType === 'month') {
    const y = filterYear;
    const m = filterMonth; // 0-indexed

    // Start = first day of selected month
    const startStr = `${y}-${pad(m + 1)}-01`;

    // End = first day of NEXT month (exclusive)
    const endYear  = m === 11 ? y + 1 : y;
    const endMonth = m === 11 ? 1 : m + 2; // 1-indexed next month
    const endStr   = `${endYear}-${pad(endMonth)}-01`;

    return {
      startDate: startStr,
      endDate:   endStr,
      label:     `${MONTHS[m]} ${y}`,
    };
  }

  if (filterType === 'year') {
    return {
      startDate: `${filterYear}-01-01`,
      endDate:   `${filterYear + 1}-01-01`,
      label:     `Year ${filterYear}`,
    };
  }

  // Financial year (April to March)
  return {
    startDate: `${filterFYStart}-04-01`,
    endDate:   `${filterFYStart + 1}-04-01`,
    label:     `FY ${filterFYStart}-${String(filterFYStart + 1).slice(-2)}`,
  };

}, [filterType, filterMonth, filterYear, filterFYStart]);

  // ── Fetch report ──────────────────────────────────────────
  const handleFetch = async () => {
    setLoading(true);
    setError('');
    try {
      const { startDate, endDate } = getDateRange();
      const result = await window.api.getHSNGSTReport({
        startDate,
        endDate,
        viewMode,
      });
      if (!result.success) throw new Error(result.message || 'Failed to load report');
      setReportData(result.data || []);
      setHasLoaded(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Totals row ────────────────────────────────────────────
  const totals = reportData.reduce(
    (acc, row) => ({
      total_qty:     acc.total_qty     + (row.total_qty     || 0),
      taxable_value: acc.taxable_value + (row.taxable_value || 0),
      cgst_amount:   acc.cgst_amount   + (row.cgst_amount   || 0),
      sgst_amount:   acc.sgst_amount   + (row.sgst_amount   || 0),
      igst_amount:   acc.igst_amount   + (row.igst_amount   || 0),
      total_tax:     acc.total_tax     + (row.total_tax     || 0),
      invoice_value: acc.invoice_value + (row.invoice_value || 0),
      listed_price:  acc.listed_price  + (row.listed_price  || 0),
    }),
    {
      total_qty: 0, taxable_value: 0, cgst_amount: 0,
      sgst_amount: 0, igst_amount: 0, total_tax: 0,
      invoice_value: 0, listed_price: 0,
    }
  );

  // ── Download ─────────────────────────────────────────────
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { label } = getDateRange();
      const modeLabel = viewMode === 'tax_only' ? 'With Tax Only' : 'All Sales';

      // Build the shop name from window title or hardcode
      const tableRows = reportData.map((row, i) => {
        const isIGST = row.tax_type === 'igst';
        const isNone = row.tax_type === 'none';
        return `
        <tr>
          <td>${i + 1}</td>
          <td>${row.hsn_code}</td>
          <td class="r">${row.total_qty}</td>
          <td class="r">${fmt(row.taxable_value)}</td>
          <td class="c">${isNone || isIGST  ? '-' : `${row.gst_percent / 2}%`}</td>
          <td class="r">${isNone || isIGST  ? '-' : fmt(row.cgst_amount)}</td>
          <td class="c">${isNone || isIGST  ? '-' : `${row.gst_percent / 2}%`}</td>
          <td class="r">${isNone || isIGST  ? '-' : fmt(row.sgst_amount)}</td>
          <td class="c">${isNone || !isIGST ? '-' : `${row.gst_percent}%`}</td>
          <td class="r">${isNone || !isIGST ? '-' : fmt(row.igst_amount)}</td>
          <td class="r bold">${fmt(row.total_tax)}</td>
          <td class="r bold blue">${fmt(row.invoice_value)}</td>
          <td class="r" style="color:#059669;font-weight:700">${fmt(row.listed_price)}</td>
        </tr>`;
      }).join('');

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>HSN GST Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      padding: 20px;
      background: #fff;
    }
    h2 {
      text-align: center;
      font-size: 16px;
      margin-bottom: 4px;
      color: #1e293b;
    }
    p.sub {
      text-align: center;
      color: #64748b;
      font-size: 11px;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    th {
      background: #1e40af;
      color: #fff;
      padding: 7px 8px;
      font-size: 10px;
      white-space: nowrap;
      text-align: left;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      white-space: nowrap;
    }
    tr:nth-child(even) td { background: #f8fafc; }
    .r    { text-align: right; }
    .c    { text-align: center; color: #6b7280; }
    .bold { font-weight: 700; }
    .blue { color: #1e40af; }
    tfoot tr td {
      background:  #dbeafe !important;
      font-weight: 700;
      font-size:   11px;
      border-top:  2px solid #1e40af;
    }
  </style>
</head>
<body>
  <h2>HSN-wise GST Report</h2>
  <p class="sub">Period: ${label} &nbsp;|&nbsp; View: ${modeLabel}</p>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>HSN Code</th>
        <th style="text-align:right">Total Qty</th>
        <th style="text-align:right">Taxable Value (₹)</th>
        <th style="text-align:center">CGST %</th>
        <th style="text-align:right">CGST Amt (₹)</th>
        <th style="text-align:center">SGST %</th>
        <th style="text-align:right">SGST Amt (₹)</th>
        <th style="text-align:center">IGST %</th>
        <th style="text-align:right">IGST Amt (₹)</th>
        <th style="text-align:right">Total Tax (₹)</th>
        <th style="text-align:right">Invoice Value (₹)</th>
        <th style="text-align:right">Listed Price / MRP (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2">TOTAL</td>
        <td class="r">${totals.total_qty}</td>
        <td class="r">${fmt(totals.taxable_value)}</td>
        <td class="c">-</td>
        <td class="r">${fmt(totals.cgst_amount)}</td>
        <td class="c">-</td>
        <td class="r">${fmt(totals.sgst_amount)}</td>
        <td class="c">-</td>
        <td class="r">${fmt(totals.igst_amount)}</td>
        <td class="r">${fmt(totals.total_tax)}</td>
        <td class="r blue">${fmt(totals.invoice_value)}</td>
        <td class="r" style="color:#059669">${fmt(totals.listed_price)}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;

      const result = await window.api.downloadHSNReport({ html });

      if (!result?.success && result?.message !== 'Cancelled by user') {
        alert('Could not download report:\n' + (result?.message || 'Unknown error'));
      }

    } catch (err) {
      console.error('[HSNGSTReport] download error:', err);
      alert('Unexpected error while downloading report.');
    } finally {
      setDownloading(false);
    }
  };

  const { label } = getDateRange();
  const fyOptions  = getFinancialYearOptions();
  const yearOptions = Array.from({ length: 6 }, (_, i) => today.getFullYear() - i);

  // ── JSX ───────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold">HSN-wise GST Report</h3>
          <p className="text-sm text-gray-500 mt-1">
            For GST filing — grouped by HSN code and tax rate
          </p>
        </div>
        {hasLoaded && reportData.length > 0 && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="btn-primary text-sm px-4 py-2"
            title="Save report as PDF to your computer"
          >
            {downloading ? '⏳ Saving…' : '⬇ Download PDF'}
          </button>
        )}
      </div>

      {/* ── Filter Bar ─────────────────────────────────────── */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5">
        <div className="flex flex-wrap gap-4 items-end">

          {/* Filter type toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Period Type
            </label>
            <div className="flex rounded overflow-hidden border border-gray-300">
              {[
                { value: 'month',     label: 'Month'    },
                { value: 'year',      label: 'Cal Year' },
                { value: 'financial', label: 'Fin Year' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilterType(opt.value)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    filterType === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Month picker */}
          {filterType === 'month' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Month
                </label>
                <select
                  value={filterMonth}
                  onChange={e => setFilterMonth(Number(e.target.value))}
                  className="input-field text-sm py-1.5"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Year
                </label>
                <select
                  value={filterYear}
                  onChange={e => setFilterYear(Number(e.target.value))}
                  className="input-field text-sm py-1.5"
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Calendar year picker */}
          {filterType === 'year' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Year
              </label>
              <select
                value={filterYear}
                onChange={e => setFilterYear(Number(e.target.value))}
                className="input-field text-sm py-1.5"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {/* Financial year picker */}
          {filterType === 'financial' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Financial Year
              </label>
              <select
                value={filterFYStart}
                onChange={e => setFilterFYStart(Number(e.target.value))}
                className="input-field text-sm py-1.5"
              >
                {fyOptions.map(fy => (
                  <option key={fy.start} value={fy.start}>{fy.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* View mode toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              View Mode
            </label>
            <div className="flex rounded overflow-hidden border border-gray-300">
              <button
                type="button"
                onClick={() => setViewMode('tax_only')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'tax_only'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                With Tax Only
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                All Sales
              </button>
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleFetch}
            disabled={loading}
            className="btn-primary px-5 py-1.5 text-sm"
          >
            {loading ? '⏳ Loading...' : '📊 Generate Report'}
          </button>

        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── Report Table ────────────────────────────────────── */}
      {hasLoaded && (
        <>
          {/* Period label */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">
              Showing: <strong>{label}</strong> &nbsp;|&nbsp;
              <strong>{viewMode === 'tax_only' ? 'With Tax Only' : 'All Sales'}</strong>
              &nbsp;|&nbsp;
              <strong>{reportData.length}</strong> HSN group(s)
            </p>
          </div>

          {reportData.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-lg mb-1">No data found</p>
              <p className="text-sm">No invoices match the selected period and filters.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width:           '100%',
                borderCollapse:  'collapse',
                fontSize:        '12px',
              }}>
                <thead>
                  <tr style={{ background: '#1e40af', color: '#fff' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>HSN Code</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Total Qty</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Taxable Value (₹)</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>CGST %</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>CGST Amt (₹)</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>SGST %</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>SGST Amt (₹)</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>IGST %</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>IGST Amt (₹)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Total Tax (₹)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Invoice Value (₹)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Listed Price / MRP (₹)</th>
                  </tr>
                </thead>

                <tbody>
                  {reportData.map((row, i) => {
                    const isIGST = row.tax_type === 'igst';
                    const isNone = row.tax_type === 'none';
                    return (
                      <tr
                        key={i}
                        style={{
                          background:    i % 2 === 0 ? '#fff' : '#f8fafc',
                          borderBottom:  '1px solid #e2e8f0',
                        }}
                      >
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>
                          {row.hsn_code}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {row.total_qty}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {fmt(row.taxable_value)}
                        </td>

                        {/* CGST % */}
                        <td style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>
                          {isNone || isIGST ? '-' : `${row.gst_percent / 2}%`}
                        </td>
                        {/* CGST Amt */}
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {isNone || isIGST ? '-' : fmt(row.cgst_amount)}
                        </td>

                        {/* SGST % */}
                        <td style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>
                          {isNone || isIGST ? '-' : `${row.gst_percent / 2}%`}
                        </td>
                        {/* SGST Amt */}
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {isNone || isIGST ? '-' : fmt(row.sgst_amount)}
                        </td>

                        {/* IGST % */}
                        <td style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>
                          {isNone || !isIGST ? '-' : `${row.gst_percent}%`}
                        </td>
                        {/* IGST Amt */}
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {isNone || !isIGST ? '-' : fmt(row.igst_amount)}
                        </td>

                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                          {fmt(row.total_tax)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#1e40af' }}>
                          {fmt(row.invoice_value)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                          {fmt(row.listed_price)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Totals footer */}
                <tfoot>
                  <tr style={{ background: '#dbeafe', fontWeight: 700, fontSize: '12px' }}>
                    <td style={tdStyle} colSpan={2}>
                      TOTAL
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {totals.total_qty}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {fmt(totals.taxable_value)}
                    </td>
                    <td style={tdStyle}>-</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {fmt(totals.cgst_amount)}
                    </td>
                    <td style={tdStyle}>-</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {fmt(totals.sgst_amount)}
                    </td>
                    <td style={tdStyle}>-</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {fmt(totals.igst_amount)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {fmt(totals.total_tax)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#1e40af' }}>
                      {fmt(totals.invoice_value)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#059669' }}>
                      {fmt(totals.listed_price)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {/* First load prompt */}
      {!hasLoaded && !loading && (
        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-4xl mb-3">📊</p>
          <p className="font-medium text-gray-600">Select filters and click Generate Report</p>
          <p className="text-sm mt-1">Report will appear here</p>
        </div>
      )}
    </div>
  );
};

// ── Table cell styles ─────────────────────────────────────────
const thStyle = {
  padding:    '8px 10px',
  fontWeight: 700,
  fontSize:   '11px',
  whiteSpace: 'nowrap',
  textAlign:  'left',
};

const tdStyle = {
  padding:  '7px 10px',
  fontSize: '11px',
};

export default HSNGSTReport;
