import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorAlert from '../components/Common/ErrorAlert';
import InvoicePrint from '../components/Billing/InvoicePrint';
import { useShopDetails } from '../context/ShopDetailsContext';

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { shop } = useShopDetails();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert error={error} />;
  if (!invoice) return <ErrorAlert error="Invoice not found" />;

  const shopData = shop || {
    shop_name: 'Medical Store',
    address: 'Not configured',
    phone: 'N/A',
  };

  return (
    <>
      {/* Control bar - hidden during print */}
      <div className="invoice-control-bar print-hidden">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Invoice #{invoice.id}</h2>
          <div className="flex gap-2">
            <button onClick={() => navigate(-1)} className="btn-secondary">
              ← Back
            </button>
            <button onClick={handlePrint} className="btn-primary">
              🖨 Print Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Invoice area - forced visible by handlePrint before PDF capture */}
      <div id="invoice-print-area" className="invoice-print-wrapper">
        <InvoicePrint invoice={invoice} shop={shopData} />
      </div>
    </>
  );
};

export default InvoiceDetail;