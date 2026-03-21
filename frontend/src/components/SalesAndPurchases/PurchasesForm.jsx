import React, { useState } from 'react';
import { usePurchaseBills } from '../../context/PurchaseBillsContext';

const PurchasesForm = ({ onSuccess }) => {
  const { createPurchaseBill, loading, error: contextError } = usePurchaseBills();
  const [formData, setFormData] = useState({
    bill_number: '',
    purchase_date: new Date().toISOString().split('T')[0],
    wholesaler_name: '',
    contact_number: '',
    total_amount: '',
    amount_paid: '0',
    notes: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear validation error for this field when user edits it
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setValidationErrors({});

    // Validation
    const errors = {};

    if (!formData.wholesaler_name.trim()) {
      errors.wholesaler_name = 'Wholesaler name is required';
    }
    if (!formData.total_amount || parseFloat(formData.total_amount) <= 0) {
      errors.total_amount = 'Total amount must be greater than 0';
    }
    if (parseFloat(formData.amount_paid) < 0) {
      errors.amount_paid = 'Amount paid cannot be negative';
    }
    if (parseFloat(formData.total_amount) > 0 && parseFloat(formData.amount_paid) > parseFloat(formData.total_amount)) {
      errors.amount_paid = 'Amount paid cannot exceed total amount';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      const payload = {
        wholesaler_name: formData.wholesaler_name.trim(),
        total_amount: parseFloat(formData.total_amount),
        amount_paid: parseFloat(formData.amount_paid) || 0,
      };

      // Only include optional fields if they have values
      if (formData.bill_number.trim()) {
        payload.bill_number = formData.bill_number.trim();
      }
      if (formData.purchase_date) {
        payload.purchase_date = formData.purchase_date;
      }
      if (formData.contact_number.trim()) {
        payload.contact_number = formData.contact_number.trim();
      }
      if (formData.notes.trim()) {
        payload.notes = formData.notes.trim();
      }

      await createPurchaseBill(payload);

      setMessage('✅ Purchase bill created successfully');
      setFormData({
        bill_number: '',
        purchase_date: new Date().toISOString().split('T')[0],
        wholesaler_name: '',
        contact_number: '',
        total_amount: '',
        amount_paid: '0',
        notes: ''
      });
      if (onSuccess) onSuccess();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      // Extract backend validation errors
      const backendErrors = err.response?.data;
      if (backendErrors && typeof backendErrors === 'object') {
        // If it's an object with field errors
        if (backendErrors.wholesaler_name) {
          setError('Wholesaler: ' + (Array.isArray(backendErrors.wholesaler_name) ? backendErrors.wholesaler_name[0] : backendErrors.wholesaler_name));
        } else if (backendErrors.total_amount) {
          setError('Amount: ' + (Array.isArray(backendErrors.total_amount) ? backendErrors.total_amount[0] : backendErrors.total_amount));
        } else if (backendErrors.amount_paid) {
          setError('Payment: ' + (Array.isArray(backendErrors.amount_paid) ? backendErrors.amount_paid[0] : backendErrors.amount_paid));
        } else {
          setError('Error: ' + JSON.stringify(backendErrors));
        }
      } else {
        setError('Failed to create purchase bill: ' + (err.response?.data?.detail || err.message));
      }
      console.error('Purchase bill creation error:', err);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Create Purchase Bill</h3>

      {message && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded border border-green-300">{message}</div>}
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded border border-red-300">{error}</div>}
      {contextError && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded border border-red-300">{contextError}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Bill Number</label>
            <input
              type="text"
              name="bill_number"
              value={formData.bill_number}
              onChange={handleChange}
              placeholder="e.g., PB-2026-001"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Purchase Date</label>
            <input
              type="date"
              name="purchase_date"
              value={formData.purchase_date}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Wholesaler Name *</label>
            <input
              type="text"
              name="wholesaler_name"
              value={formData.wholesaler_name}
              onChange={handleChange}
              placeholder="e.g., ABC Electrical Wholesale"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                validationErrors.wholesaler_name ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
              required
            />
            {validationErrors.wholesaler_name && (
              <p className="text-red-600 text-sm mt-1">{validationErrors.wholesaler_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Contact Number</label>
            <input
              type="tel"
              name="contact_number"
              value={formData.contact_number}
              onChange={handleChange}
              placeholder="e.g., 9876543210"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Total Amount *</label>
            <input
              type="number"
              name="total_amount"
              value={formData.total_amount}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                validationErrors.total_amount ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
              required
            />
            {validationErrors.total_amount && (
              <p className="text-red-600 text-sm mt-1">{validationErrors.total_amount}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Amount Paid</label>
            <input
              type="number"
              name="amount_paid"
              value={formData.amount_paid}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                validationErrors.amount_paid ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {validationErrors.amount_paid && (
              <p className="text-red-600 text-sm mt-1">{validationErrors.amount_paid}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Any additional notes about this purchase..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="3"
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {loading ? 'Creating...' : 'Create Purchase Bill'}
        </button>
      </form>
    </div>
  );
};

export default PurchasesForm;

