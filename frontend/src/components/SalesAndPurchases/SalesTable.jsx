import React, { useEffect, useState } from 'react';
import { useSalesBills } from '../../context/SalesBillsContext';

const SalesTable = ({ period = 'month' }) => {
  const { salesBills, loading, error, fetchSalesBills, updateAmountPaid, searchSalesBills } = useSalesBills();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSalesBills();
  }, [period]);

  const handleSearch = async (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.trim()) {
      await searchSalesBills(value);
    } else {
      await fetchSalesBills();
    }
  };

  const handleEditClick = (bill) => {
    setEditingId(bill.id);
    setEditAmount(bill.amount_paid);
  };

  const handleSave = async (billId) => {
    try {
      const amount = parseFloat(editAmount);
      if (isNaN(amount) || amount < 0) {
        setMessage('Invalid amount');
        return;
      }
      await updateAmountPaid(billId, amount);
      setEditingId(null);
      setMessage('Amount paid updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to update amount paid');
      console.error(err);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditAmount('');
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
    return <div className="text-center py-4">Loading sales data...</div>;
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
          placeholder="Search by Bill Number or Customer..."
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

      {salesBills.length === 0 ? (
        <div className="text-center py-8 text-gray-600">
          No sales bills found for this period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="text-left py-3 px-4">Bill #</th>
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Customer Name</th>
                <th className="text-right py-3 px-4">Total Amount</th>
                <th className="text-right py-3 px-4">Amount Paid</th>
                <th className="text-right py-3 px-4">Amount Due</th>
                <th className="text-center py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {salesBills.map(bill => (
                <tr key={bill.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4 font-semibold">{bill.bill_number}</td>
                  <td className="py-3 px-4 text-gray-600">{formatDate(bill.date)}</td>
                  <td className="py-3 px-4">{bill.customer_name}</td>
                  <td className="py-3 px-4 text-right font-semibold">₹{formatCurrency(bill.total_amount)}</td>
                  <td className="py-3 px-4 text-right">
                    {editingId === bill.id ? (
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
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
                      <button
                        onClick={() => handleEditClick(bill)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-sm text-gray-600 mt-4">
        Total Bills: {salesBills.length}
      </div>
    </div>
  );
};

export default SalesTable;
