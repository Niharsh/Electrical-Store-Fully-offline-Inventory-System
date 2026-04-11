import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorAlert from '../components/Common/ErrorAlert';
import InvoicePrint from '../components/Billing/InvoicePrint';
import { useShopDetails } from '../context/ShopDetailsContext';

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { shop } = useShopDetails();

  const [invoice, setInvoice]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [qrDataUrl, setQrDataUrl]       = useState(null);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [downloading, setDownloading]   = useState(false);
  const whatsappRef                     = useRef(null);

  // ── Load invoice ──────────────────────────────────────────────
  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        if (!window?.api?.getInvoiceById) {
          throw new Error('window.api.getInvoiceById not available');
        }
        const response = await window.api.getInvoiceById(parseInt(id));
        if (response && response.success === false) {
          throw new Error(response.message || 'Failed to load invoice');
        }
        setInvoice(response.data);
      } catch (err) {
        setError(err.message || 'Failed to load invoice details');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id]);

  // ── Load QR image ─────────────────────────────────────────────
  useEffect(() => {
    const loadQrImage = async () => {
      try {
        if (!window?.api?.getQrImage) {
          console.warn('[InvoiceDetail] window.api.getQrImage not available');
          return;
        }
        const result = await window.api.getQrImage();
        if (result.success && result.dataUrl) {
          setQrDataUrl(result.dataUrl);
        }
      } catch (err) {
        console.log('[InvoiceDetail] QR image not found', err);
      }
    };
    loadQrImage();
  }, []);

  // ── Close WhatsApp dropdown on outside click ──────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (whatsappRef.current && !whatsappRef.current.contains(e.target)) {
        setShowWhatsApp(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Print handler (unchanged) ─────────────────────────────────
  const handlePrint = async () => {
    try {
      const result = await window.api.printInvoice();
      if (!result?.success) {
        console.error('[print] Failed:', result?.message);
        alert('Could not generate PDF:\n' + (result?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('[print] IPC error:', err);
      alert('Unexpected error while printing.');
    }
  };

  // ── Download PDF handler (Feature 1) ─────────────────────────
  const handleDownload = async () => {
    try {
      setDownloading(true);
      const result = await window.api.downloadInvoice();
      if (!result?.success && result?.message !== 'Cancelled by user') {
        alert('Could not download PDF:\n' + (result?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('[download] IPC error:', err);
      alert('Unexpected error while downloading.');
    } finally {
      setDownloading(false);
    }
  };

  // ── WhatsApp message builder ──────────────────────────────────
  const buildWhatsAppMessage = () => {
    if (!invoice) return '';
    const shopName = shop?.shop_name || 'OJASHWAI ELECTRICALS';
    const invNum   = invoice.invoice_number || `INV-${invoice.id}`;
    const customer = invoice.bill_to_name || invoice.customer_name || '';
    const amount   = parseFloat(invoice.total_amount || 0).toFixed(2);
    const date     = invoice.created_at
      ? (() => {
          const d = new Date(invoice.created_at);
          return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
        })()
      : '';

    return (
      `Invoice #${invNum}\n` +
      `Customer: ${customer}\n` +
      `Amount: ₹${amount}\n` +
      `Date: ${date}\n` +
      `${shopName}\n` +
      `Thank you for your business!`
    );
  };

  // ── WhatsApp share handler (Feature 2) ───────────────────────
  const handleWhatsApp = async (useWeb) => {
    try {
      setShowWhatsApp(false);

      // Step 1 — Generate and save PDF to Downloads silently
      let pdfSaved = false;
      let savedPath = '';
      try {
        const dlResult = await window.api.downloadInvoiceSilent();
        if (dlResult?.success) {
          pdfSaved = true;
          savedPath = dlResult.filePath;
        }
      } catch (e) {
        // PDF save failed — continue anyway
      }

      // Step 2 — Open WhatsApp with text message
      const message = buildWhatsAppMessage();
      const result  = await window.api.shareWhatsapp({ message, useWeb });

      if (!result?.success) {
        alert('Could not open WhatsApp:\n' + (result?.message || 'Unknown error'));
        return;
      }

      // Step 3 — Inform user to attach PDF manually
      if (pdfSaved) {
        setTimeout(() => {
          alert(
            `📎 PDF saved to:\n${savedPath}\n\n` +
            `WhatsApp is open. Please attach the PDF manually\n` +
            `using the 📎 attachment button in WhatsApp.`
          );
        }, 1500);
      }

    } catch (err) {
      console.error('[whatsapp] IPC error:', err);
      alert('Unexpected error while opening WhatsApp.');
    }
  };

  // ── Guards ────────────────────────────────────────────────────
  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorAlert error={error} />;
  if (!invoice) return <ErrorAlert error="Invoice not found" />;

  const shopData = shop || {
    shop_name: 'Electrical Store',
    address:   'Not configured',
    phone:     'N/A',
  };

  return (
    <>
      {/* ── Control bar (hidden during print) ───────────────── */}
      <div className="invoice-control-bar print-hidden">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Invoice #{invoice.id}</h2>

          <div className="flex gap-2 items-center">

            {/* Back */}
            <button
              onClick={() => navigate(-1)}
              className="btn-secondary"
            >
              ← Back
            </button>

            {/* Print Invoice */}
            <button
              onClick={handlePrint}
              className="btn-primary"
            >
              🖨 Print Invoice
            </button>

            {/* Download PDF */}
            <button
              onClick={handleDownload}
              className="btn-primary"
              disabled={downloading}
              title="Save PDF to your computer"
            >
              {downloading ? '⏳ Saving…' : '⬇ Download PDF'}
            </button>

            {/* WhatsApp dropdown */}
            <div style={{ position: 'relative' }} ref={whatsappRef}>
              <button
                onClick={() => setShowWhatsApp(prev => !prev)}
                className="btn-success"
                title="Share invoice on WhatsApp"
              >
                💬 WhatsApp ▾
              </button>

              {showWhatsApp && (
                <div style={{
                  position:     'absolute',
                  top:          '110%',
                  right:        0,
                  background:   '#fff',
                  border:       '1px solid #d1d5db',
                  borderRadius: '8px',
                  boxShadow:    '0 4px 16px rgba(0,0,0,0.12)',
                  zIndex:       1000,
                  minWidth:     '180px',
                  overflow:     'hidden',
                }}>
                  <button
                    onClick={() => handleWhatsApp(false)}
                    style={{
                      display:    'block',
                      width:      '100%',
                      padding:    '10px 16px',
                      textAlign:  'left',
                      background: 'none',
                      border:     'none',
                      cursor:     'pointer',
                      fontSize:   '14px',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    📱 WhatsApp App
                  </button>

                  <hr style={{ margin: 0, borderColor: '#e5e7eb' }} />

                  <button
                    onClick={() => handleWhatsApp(true)}
                    style={{
                      display:    'block',
                      width:      '100%',
                      padding:    '10px 16px',
                      textAlign:  'left',
                      background: 'none',
                      border:     'none',
                      cursor:     'pointer',
                      fontSize:   '14px',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    🌐 WhatsApp Web
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Invoice print area ───────────────────────────────── */}
      <div id="invoice-print-area" className="invoice-print-wrapper">
        <InvoicePrint
          invoice={invoice}
          shop={shopData}
          qrDataUrl={qrDataUrl}
        />
      </div>
    </>
  );
};

export default InvoiceDetail;