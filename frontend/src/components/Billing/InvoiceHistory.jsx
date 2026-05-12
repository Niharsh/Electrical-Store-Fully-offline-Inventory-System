import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../../context/InvoiceContext';
import LoadingSpinner from '../Common/LoadingSpinner';
import ErrorAlert from '../Common/ErrorAlert';

const InvoiceHistory = ({ onViewDetails }) => {
  const { invoices, loading, error, fetchInvoices, deleteInvoice } = useInvoices();
  const navigate = useNavigate();
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleDeleteClick = async (invoice) => {
    // Show confirmation dialog
    const confirmDelete = window.confirm(
      `Are you sure you want to delete invoice ${invoice.invoice_number || `INV-${invoice.id}`}?\n\nThis action will:\n• Delete the invoice\n• Restore all product quantities to inventory\n\nThis cannot be undone.`
    );

    if (!confirmDelete) return;

    setDeleteLoading(true);
    try {
      await deleteInvoice(invoice.id);
      // Success message would be shown by context error handling or you could add a toast here
    } catch (err) {
      console.error('Delete failed:', err);
      // Error is already set in context
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="card">
      <h2 className="text-2xl font-bold mb-6">Invoice History</h2>

      {error && <ErrorAlert error={error} />}

      {invoices.length === 0 ? (
        <p className="text-gray-600 text-center py-8">No invoices found yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3">Invoice #</th>
                <th className="text-left py-3">Customer</th>
                <th className="text-left py-3">Date</th>
                <th className="text-right py-3">Amount</th>
                <th className="text-center py-3">Items</th>
                <th className="text-center py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(invoice => (
                <tr key={invoice.id} className="table-row">
                  <td className="py-4 font-semibold text-sky-600">
                    {invoice.invoice_number ? invoice.invoice_number : `INV-${invoice.id}`}
                  </td>
                  <td className="py-4">{invoice.customer_name}</td>
                  <td className="py-4 text-gray-600">{formatDate(invoice.created_at)}</td>
                  <td className="py-4 text-right font-semibold">
                    ₹{parseFloat(invoice.total_amount).toFixed(2)}
                  </td>
                  <td className="py-4 text-center text-gray-600">
                    {invoice.items?.length || 0}
                  </td>

                  {/* ── Actions column: View + Edit + Delete ── */}
                  <td className="py-4 text-center">
                    <div className="flex items-center justify-center gap-2">

                      {/* View button */}
                      <button
                        onClick={() => navigate(`/billing/invoices/${invoice.id}`)}
                        className="btn-secondary text-sm px-3 py-1"
                        disabled={deleteLoading}
                      >
                        View
                      </button>

                      {/* Edit button */}
                      <button
                        onClick={() => navigate(`/billing/invoices/${invoice.id}/edit`)}
                        className="text-sm px-3 py-1 rounded font-medium
                                   bg-amber-500 hover:bg-amber-600
                                   text-white transition-colors duration-150 disabled:opacity-50"
                        disabled={deleteLoading}
                      >
                        ✏️ Edit
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => handleDeleteClick(invoice)}
                        className="text-sm px-3 py-1 rounded font-medium
                                   bg-red-500 hover:bg-red-600
                                   text-white transition-colors duration-150 disabled:opacity-50"
                        disabled={deleteLoading}
                        title="Delete invoice and restore inventory"
                      >
                        🗑️ Delete
                      </button>

                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InvoiceHistory;