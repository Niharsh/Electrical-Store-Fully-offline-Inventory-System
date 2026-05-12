import React, { useState } from 'react';
import { usePurchaseBills } from '../../context/PurchaseBillsContext';
import PDFImportWidget from './PDFImportWidget';

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
  const [pdfConfidence, setPdfConfidence] = useState(null);
  const [importedProducts, setImportedProducts] = useState([]);

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

      // Add imported products to inventory
      if (importedProducts.length > 0) {
        let added = 0;
        let failed = 0;
        for (const product of importedProducts) {
          try {
            // Check if product already exists by name
          const searchResult = await window.api.searchProducts(product.product_name);
          const existing = searchResult?.data?.results?.find(
            p => p.name.toLowerCase().trim() === product.product_name.toLowerCase().trim()
          );
          
          if (existing) {
            // Product exists — add a new batch to it
            const updatedProduct = {
              ...existing,
              batches: [
                ...(existing.batches || []),
                {
                  quantity: product.quantity,
                  mrp: product.mrp || 0,
                  selling_rate: product.selling_rate || 0,
                  cost_price: product.cost_price || 0,
                }
              ]
            };
            await window.api.updateProduct(existing.id, updatedProduct);
          } else {
            // New product — create it
            await window.api.addProduct({
              name: product.product_name,
              hsn_code: product.hsn_code || '',
              unit: product.unit || 'PCS',
              batches: [{
                quantity: product.quantity,
                mrp: product.mrp || 0,
                selling_rate: product.selling_rate || 0,
                cost_price: product.cost_price || 0,
              }]
            });
          }
            added++;
          } catch (productErr) {
            console.error('Failed to add product:', product.product_name, productErr);
            failed++;
          }
        }
        setMessage(`✅ Purchase bill created. ${added} products added to inventory${failed > 0 ? `, ${failed} failed` : ''}.`);
      } else {
        setMessage('✅ Purchase bill created successfully');
      }

      setImportedProducts([]);
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

  const getConfidenceBadgeColor = (score) => {
    if (score >= 80) return 'bg-green-50 border-green-200 text-green-700';
    if (score >= 50) return 'bg-yellow-50 border-yellow-200 text-yellow-700';
    return 'bg-red-50 border-red-200 text-red-700';
  };

  const getConfidenceText = (score) => {
    if (score >= 80) return '✅ Extracted successfully';
    if (score >= 50) return '⚠️ Partially extracted — please review';
    return '❌ Low confidence — check all fields';
  };

  const handleImportSuccess = (pdfData) => {
  setPdfConfidence(pdfData.confidence || 0);
  setImportedProducts(pdfData.products || []);

  setFormData(prev => ({
    ...prev,
    wholesaler_name: pdfData.wholesaler_name || prev.wholesaler_name,
    bill_number: pdfData.bill_number || prev.bill_number,
    purchase_date: pdfData.bill_date || prev.purchase_date,
  }));

  setMessage(`✅ PDF imported successfully (Confidence: ${pdfData.confidence}%)`);
  setTimeout(() => setMessage(''), 5000);
};

  const handleImportError = (errorMsg) => {
    setError(`Failed to import PDF: ${errorMsg}`);
    setTimeout(() => setError(''), 5000);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-6">Create Purchase Bill</h3>

      {/* PDF Import Widget */}
      <PDFImportWidget 
        onImportSuccess={handleImportSuccess}
        onImportError={handleImportError}
      />

      {/* Confidence Badge */}
      {pdfConfidence !== null && (
        <div className={`mb-6 p-3 border rounded-lg ${getConfidenceBadgeColor(pdfConfidence)}`}>
          <p className="text-sm font-medium">{getConfidenceText(pdfConfidence)}</p>
          <p className="text-xs mt-1">All fields are editable. Please verify extracted data before saving.</p>
        </div>
      )}

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

