import React, { useState } from 'react';
import { useInvoices } from '../../context/InvoiceContext';
import { useProducts } from '../../context/ProductContext';
import ErrorAlert from '../Common/ErrorAlert';

const BillingForm = ({ onBillingComplete }) => {
  const { createInvoice, error: invoiceError } = useInvoices();
  const { products } = useProducts();
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [billItems, setBillItems] = useState([]);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    notes: '',
  });

  const handleAddItem = () => {
    setBillItems([...billItems, { 
      product_id: '', 
      batch_number: '',
      quantity: '', 
      selling_rate: '',
      mrp: ''
    }]);
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...billItems];
    updatedItems[index][field] = value;

    // Auto-fill batches and selling rate if product is selected
    if (field === 'product_id' && value) {
      const selectedProduct = products.find(p => p.id === parseInt(value));
      if (selectedProduct && selectedProduct.batches && selectedProduct.batches.length > 0) {
        // Set first batch as default
        updatedItems[index].batch_number = selectedProduct.batches[0].batch_number;
        updatedItems[index].selling_rate = selectedProduct.batches[0].selling_rate;
        updatedItems[index].mrp = selectedProduct.batches[0].mrp;
      } else {
        updatedItems[index].batch_number = '';
        updatedItems[index].selling_rate = '';
        updatedItems[index].mrp = '';
      }
    }

    // Auto-fill selling rate and MRP when batch is selected
    if (field === 'batch_number' && updatedItems[index].product_id) {
      const selectedProduct = products.find(p => p.id === parseInt(updatedItems[index].product_id));
      if (selectedProduct && selectedProduct.batches) {
        const selectedBatch = selectedProduct.batches.find(b => b.batch_number === value);
        if (selectedBatch) {
          updatedItems[index].selling_rate = selectedBatch.selling_rate;
          updatedItems[index].mrp = selectedBatch.mrp;
        }
      }
    }

    setBillItems(updatedItems);
  };

  const handleRemoveItem = (index) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setLoading(true);

    try {
      if (!formData.customer_name) {
        throw new Error('Customer name is required');
      }

      if (billItems.length === 0) {
        throw new Error('Add at least one item to the bill');
      }

      // Validate all items have required fields
      for (let i = 0; i < billItems.length; i++) {
        const item = billItems[i];
        if (!item.product_id || !item.batch_number || !item.quantity || !item.selling_rate) {
          throw new Error(`Item ${i + 1} is missing required fields (product, batch, quantity, selling rate)`);
        }
      }

      // Prepare invoice data with batch and selling rate information
      const invoiceData = {
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone || null,
        notes: formData.notes,
        items: billItems.map(item => ({
          product_id: parseInt(item.product_id),
          batch_number: item.batch_number,
          quantity: parseInt(item.quantity),
          selling_rate: parseFloat(item.selling_rate),
          mrp: parseFloat(item.mrp), // For invoice display only
        })),
      };

      const newInvoice = await createInvoice(invoiceData);

      // Reset form
      setBillItems([]);
      setFormData({
        customer_name: '',
        customer_phone: '',
        notes: '',
      });

      if (onBillingComplete) {
        onBillingComplete(newInvoice);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to create bill');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card max-w-4xl">
      <h2 className="text-2xl font-bold mb-6">Create Invoice</h2>

      {(formError || invoiceError) && (
        <ErrorAlert error={formError || invoiceError} onDismiss={() => setFormError('')} />
      )}

      {/* Customer Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-semibold mb-2">Customer Name *</label>
          <input
            type="text"
            value={formData.customer_name}
            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            className="input-field"
            placeholder="Enter customer name"
          />
        </div>

        <div>
          <label className="block font-semibold mb-2">Phone Number</label>
          <input
            type="tel"
            value={formData.customer_phone}
            onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
            className="input-field"
            placeholder="Optional"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block font-semibold mb-2">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="input-field resize-none"
            rows="2"
            placeholder="Add any notes for this bill"
          />
        </div>
      </div>

      {/* Bill Items */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-4">Bill Items (Products)</h3>
        
        {billItems.length === 0 ? (
          <p className="text-gray-600 mb-4">No items added. Click "Add Item" to start.</p>
        ) : (
          <div className="space-y-4 mb-4">
            {billItems.map((item, index) => {
              const selectedProduct = products.find(p => p.id === parseInt(item.product_id));
              const availableBatches = selectedProduct?.batches || [];

              return (
                <div key={index} className="bg-gray-50 p-4 rounded-lg grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Product *</label>
                    <select
                      value={item.product_id}
                      onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                      className="input-field text-sm"
                    >
                      <option value="">Select product</option>
                      {products.map(p => {
                        const typeDisplay = p.product_type
                          .split('_')
                          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(' ');
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name} ({typeDisplay})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Batch *</label>
                    <select
                      value={item.batch_number}
                      onChange={(e) => handleItemChange(index, 'batch_number', e.target.value)}
                      className="input-field text-sm"
                      disabled={!selectedProduct || availableBatches.length === 0}
                    >
                      <option value="">Select batch</option>
                      {availableBatches.map((batch, bIdx) => (
                        <option key={bIdx} value={batch.batch_number}>
                          {batch.batch_number} (Qty: {batch.quantity})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Quantity *</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      className="input-field text-sm"
                      min="1"
                      placeholder="Qty"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Selling Rate (₹) *</label>
                    <input
                      type="number"
                      value={item.selling_rate}
                      onChange={(e) => handleItemChange(index, 'selling_rate', e.target.value)}
                      className="input-field text-sm bg-gray-200 cursor-not-allowed"
                      step="0.01"
                      placeholder="Auto-filled"
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">MRP (₹) (Reference)</label>
                    <input
                      type="number"
                      value={item.mrp}
                      onChange={(e) => handleItemChange(index, 'mrp', e.target.value)}
                      className="input-field text-sm bg-gray-100 cursor-not-allowed"
                      step="0.01"
                      placeholder="Auto-filled"
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Total</label>
                    <div className="text-lg font-bold text-green-600 py-2">
                      ₹{(item.quantity && item.selling_rate ? (parseInt(item.quantity) * parseFloat(item.selling_rate)).toFixed(2) : '0.00')}
                    </div>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="btn-danger w-full text-sm py-2"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={handleAddItem}
          className="btn-secondary mb-4"
        >
          + Add Item
        </button>
      </div>

      <div className="bg-sky-50 p-4 rounded-lg mb-6">
        <p className="text-gray-600 text-sm">
          ✓ Selling Rate is auto-populated from the selected batch (used for billing)<br/>
          ✓ MRP is auto-populated from the selected batch (for invoice reference only)<br/>
          ✓ Billing total calculated using Selling Rate ONLY<br/>
          ✓ Quantity will be deducted from the selected batch<br/>
          ✓ Cost Price is internal reference only (not shown here)
        </p>
      </div>

      <button
        type="submit"
        disabled={loading || billItems.length === 0}
        className="btn-primary w-full md:w-auto"
      >
        {loading ? 'Creating...' : 'Create Invoice'}
      </button>
    </form>
  );
};

export default BillingForm;
