import React, { useEffect, useState } from 'react';
import { usePurchaseBills } from '../../context/PurchaseBillsContext';

const PurchasesTable = ({ period = 'month' }) => {
  const { purchaseBills, loading, error, fetchPurchaseBills, updatePurchaseBill, deletePurchaseBill, searchPurchaseBills } = usePurchaseBills();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchPurchaseBills();
  }, [period]);

  const handleSearch = async (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.trim()) {
      await searchPurchaseBills(value);
    } else {
      await fetchPurchaseBills();
    }
  };

  const handleEditClick = (bill) => {
    setEditingId(bill.id);
    setEditData({
      amount_paid: bill.amount_paid,
      notes: bill.notes || ''
    });
  };

  const handleSave = async (billId) => {
    try {
      const amount = parseFloat(editData.amount_paid);
      if (isNaN(amount) || amount < 0) {
        setMessage('Invalid amount');
        return;
      }
      await updatePurchaseBill(billId, {
        amount_paid: amount,
        notes: editData.notes
      });
      setEditingId(null);
      setEditData({});
      setMessage('Purchase bill updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to update purchase bill');
      console.error(err);
    }
  };

  const handleDelete = async (billId) => {
    if (window.confirm('Are you sure you want to delete this purchase bill?')) {
      try {
        await deletePurchaseBill(billId);
        setMessage('Purchase bill deleted successfully');
        setTimeout(() => setMessage(''), 3000);
      } catch (err) {
        setMessage('Failed to delete purchase bill');
        console.error(err);
      }
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (value) => {
    return parseFloat(value).toFixed(2);
  };

  if (loading) {
    return <div className="text-center py-4">Loading purchase data...</div>;
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className={`p-3 rounded ${message.includes('Failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      <div className="flex gap-4 items-center mb-4">
        <input
          type="text"
          placeholder="Search by Bill Number or Wholesaler..."
          value={searchTerm}
          onChange={handleSearch}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded">
          Error: {error}
        </div>
      )}

      {purchaseBills.length === 0 ? (
        <div className="text-center py-8 text-gray-600">
          No purchase bills found for this period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="text-left py-3 px-4">Bill #</th>
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Wholesaler</th>
                <th className="text-left py-3 px-4">Contact</th>
                <th className="text-right py-3 px-4">Total Amount</th>
                <th className="text-right py-3 px-4">Amount Paid</th>
                <th className="text-right py-3 px-4">Amount Due</th>
                <th className="text-center py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {purchaseBills.map(bill => (
                <tr key={bill.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4 font-semibold">{bill.bill_number}</td>
                  <td className="py-3 px-4 text-gray-600">{formatDate(bill.date)}</td>
                  <td className="py-3 px-4">{bill.wholesaler_name}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{bill.contact_number || '-'}</td>
                  <td className="py-3 px-4 text-right font-semibold">₹{formatCurrency(bill.total_amount)}</td>
                  <td className="py-3 px-4 text-right">
                    {editingId === bill.id ? (
                      <input
                        type="number"
                        value={editData.amount_paid}
                        onChange={(e) => setEditData({...editData, amount_paid: e.target.value})}
                        className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        step="0.01"
                        min="0"
                      />
                    ) : (
                      <span className={`font-semibold ${parseFloat(bill.amount_paid) > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        ₹{formatCurrency(bill.amount_paid)}
                      </span>
                    )}
                  </td>
                  <td className={`py-3 px-4 text-right font-semibold ${parseFloat(bill.amount_due) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    ₹{formatCurrency(bill.amount_due)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {editingId === bill.id ? (
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleSave(bill.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleEditClick(bill)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(bill.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-sm text-gray-600 mt-4">
        Total Bills: {purchaseBills.length}
      </div>
    </div>
  );
};

export default PurchasesTable;
