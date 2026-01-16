import React, { useState } from 'react';
import { usePurchaseBills } from '../../context/PurchaseBillsContext';

const PurchasesForm = ({ onSuccess }) => {
  const { createPurchaseBill, loading, error: contextError } = usePurchaseBills();
  const [formData, setFormData] = useState({
    bill_number: '',
    date: new Date().toISOString().split('T')[0],
    wholesaler_name: '',
    contact_number: '',
    total_amount: '',
    amount_paid: '0',
    notes: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // Validation
    if (!formData.bill_number.trim()) {
      setError('Bill number is required');
      return;
    }
    if (!formData.wholesaler_name.trim()) {
      setError('Wholesaler name is required');
      return;
    }
    if (!formData.total_amount || parseFloat(formData.total_amount) <= 0) {
      setError('Total amount must be greater than 0');
      return;
    }
    if (parseFloat(formData.amount_paid) < 0) {
      setError('Amount paid cannot be negative');
      return;
    }
    if (parseFloat(formData.amount_paid) > parseFloat(formData.total_amount)) {
      setError('Amount paid cannot exceed total amount');
      return;
    }

    try {
      await createPurchaseBill({
        bill_number: formData.bill_number,
        date: formData.date,
        wholesaler_name: formData.wholesaler_name,
        contact_number: formData.contact_number,
        total_amount: parseFloat(formData.total_amount),
        amount_paid: parseFloat(formData.amount_paid),
        notes: formData.notes
      });

      setMessage('Purchase bill created successfully');
      setFormData({
        bill_number: '',
        date: new Date().toISOString().split('T')[0],
        wholesaler_name: '',
        contact_number: '',
        total_amount: '',
        amount_paid: '0',
        notes: ''
      });
      if (onSuccess) onSuccess();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to create purchase bill: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Add New Purchase Bill</h3>

      {message && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">{message}</div>}
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
      {contextError && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{contextError}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Bill Number *</label>
            <input
              type="text"
              name="bill_number"
              value={formData.bill_number}
              onChange={handleChange}
              placeholder="e.g., PB-2024-001"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Date *</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Wholesaler Name *</label>
            <input
              type="text"
              name="wholesaler_name"
              value={formData.wholesaler_name}
              onChange={handleChange}
              placeholder="e.g., Pharma Wholesalers Ltd"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Contact Number</label>
            <input
              type="tel"
              name="contact_number"
              value={formData.contact_number}
              onChange={handleChange}
              placeholder="e.g., +91-9876543210"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Total Amount (₹) *</label>
            <input
              type="number"
              name="total_amount"
              value={formData.total_amount}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Amount Paid (₹)</label>
            <input
              type="number"
              name="amount_paid"
              value={formData.amount_paid}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="e.g., Payment terms: Net 30"
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {formData.total_amount && (
          <div className="bg-blue-50 p-3 rounded">
            <p className="text-sm">
              <span>Total Amount: ₹{parseFloat(formData.total_amount || 0).toFixed(2)}</span>
              <span className="ml-4">Amount Paid: ₹{parseFloat(formData.amount_paid || 0).toFixed(2)}</span>
              <span className="ml-4 font-semibold">Amount Due: ₹{(parseFloat(formData.total_amount || 0) - parseFloat(formData.amount_paid || 0)).toFixed(2)}</span>
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
        >
          {loading ? 'Creating...' : 'Create Purchase Bill'}
        </button>
      </form>
    </div>
  );
};

export default PurchasesForm;
