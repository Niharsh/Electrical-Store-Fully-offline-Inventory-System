import React, { useState } from 'react';
import { useEffect } from 'react';
import { useInvoices } from '../../context/InvoiceContext';
import { useProducts } from '../../context/ProductContext';
import ErrorAlert from '../Common/ErrorAlert';


const BillingForm = ({ onBillingComplete }) => {
  const { createInvoice, error: invoiceError } = useInvoices();
  const { products, fetchProducts } = useProducts();
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [billItems, setBillItems] = useState([]);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_dl_number: '',
    customer_address: '',
    notes: '',
    discount_percent: '',
  });
  useEffect(() => {
  if (products.length === 0) {
    fetchProducts();
  }
}, []);


  const handleAddItem = () => {
    setBillItems([...billItems, { 
      product_id: '', 
      batch_number: '',
      quantity: '', 
      original_selling_rate: '', // Store original batch selling rate
      selling_rate: '', // Allow editing
      mrp: '',
      hsn_code: '', // Auto-filled from product
      discount_percent: formData.discount_percent || '', // Pre-fill from top-level discount
      gst_percent: '', // Will be auto-filled from product's HSN if available
      is_return: false, // Return flag
      return_reason: '' // Return reason
    }]);
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...billItems];
    updatedItems[index][field] = value;

    // Auto-fill batches, selling rate, HSN code, and GST if product is selected
    if (field === 'product_id' && value) {
      const selectedProduct = products.find(p => p.id === parseInt(value));
      if (selectedProduct && selectedProduct.batches && selectedProduct.batches.length > 0) {
        // Set first batch as default
        updatedItems[index].batch_number = selectedProduct.batches[0].batch_number;
        updatedItems[index].original_selling_rate = selectedProduct.batches[0].selling_rate;
        updatedItems[index].selling_rate = selectedProduct.batches[0].selling_rate;
        updatedItems[index].mrp = selectedProduct.batches[0].mrp;
        
        // 🆕 Auto-fill HSN code and GST from product's HSN
        updatedItems[index].hsn_code = selectedProduct.hsn_code || '';
        updatedItems[index].gst_percent = selectedProduct.gst_rate || '';
      } else {
        updatedItems[index].batch_number = '';
        updatedItems[index].original_selling_rate = '';
        updatedItems[index].selling_rate = '';
        updatedItems[index].mrp = '';
        updatedItems[index].hsn_code = '';
        updatedItems[index].gst_percent = '';
      }
    }

    // Auto-fill selling rate and MRP when batch is selected
    if (field === 'batch_number' && updatedItems[index].product_id) {
      const selectedProduct = products.find(p => p.id === parseInt(updatedItems[index].product_id));
      if (selectedProduct && selectedProduct.batches) {
        const selectedBatch = selectedProduct.batches.find(b => b.batch_number === value);
        if (selectedBatch) {
          updatedItems[index].original_selling_rate = selectedBatch.selling_rate;
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
        // Validate selling rate is positive
        if (parseFloat(item.selling_rate) <= 0) {
          throw new Error(`Item ${i + 1}: Selling rate must be greater than 0`);
        }
      }

      // Prepare invoice data with batch and selling rate information
      const invoiceData = {
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone || "",
        customer_dl_number: formData.customer_dl_number || "",
        customer_address: formData.customer_address || "",
        notes: formData.notes,
        discount_percent: parseFloat(formData.discount_percent) || 0,
        items: billItems.map(item => ({
          product_id: parseInt(item.product_id),
          batch_number: item.batch_number,
          quantity: parseInt(item.quantity),
          original_selling_rate: parseFloat(item.original_selling_rate), // Store original for history
          selling_rate: parseFloat(item.selling_rate), // Final price (may be edited)
          mrp: parseFloat(item.mrp), // For invoice display only
          discount_percent: parseFloat(item.discount_percent) || 0, // Per-item discount
          gst_percent: parseFloat(item.gst_percent) || 0, // Per-item GST
          is_return: item.is_return || false, // Return flag
          return_reason: item.return_reason || '' // Return reason
        })),
      };

      console.log('📤 BillingForm: Customer address value:', formData.customer_address);
      console.log('📤 BillingForm: Sending invoice payload:', JSON.stringify(invoiceData, null, 2));

      const newInvoice = await createInvoice(invoiceData);
      console.log('✅ BillingForm: Invoice created successfully:', newInvoice);

      // Reset form
      setBillItems([]);
      setFormData({
        customer_name: '',
        customer_phone: '',
        customer_dl_number: '',
        customer_address: '',
        notes: '',
        discount_percent: '',
      });

      // Refetch products to ensure inventory quantities are current
      // This prevents stale product selections in the form
      console.log('🔄 BillingForm: Refetching products after invoice creation');
      await fetchProducts();

      if (onBillingComplete) {
        onBillingComplete(newInvoice);
      }
    } catch (err) {
      console.error('❌ BillingForm: Error creating invoice:', err);
      console.error('  Response data:', err.response?.data);
      console.error('  Status:', err.response?.status);
      
      // ✅ Enhanced error handling for backend validation errors
      let errorMessage = 'Failed to create bill';
      
      if (err.response?.data) {
        const data = err.response.data;
        
        // Handle serializer ValidationError (dict format)
        if (typeof data === 'object' && !Array.isArray(data)) {
          // Check for 'items' field errors (array of validation errors)
          if (data.items && Array.isArray(data.items)) {
            // Get the first validation error message
            if (data.items[0]) {
              errorMessage = Array.isArray(data.items[0]) 
                ? data.items[0][0] 
                : data.items[0];
            }
          }
          // Check for 'detail' field (generic error message)
          else if (data.detail) {
            errorMessage = data.detail;
          }
          // Check for other field errors
          else {
            const firstErrorKey = Object.keys(data)[0];
            if (firstErrorKey) {
              const errorValue = data[firstErrorKey];
              errorMessage = Array.isArray(errorValue) ? errorValue[0] : errorValue;
            }
          }
        }
        // Handle list format errors
        else if (Array.isArray(data)) {
          errorMessage = data[0] || errorMessage;
        }
        // Handle string error messages
        else if (typeof data === 'string') {
          errorMessage = data;
        }
      }
      // Fallback to error message or network error
      else if (err.message) {
        errorMessage = err.message;
      }
      
      console.log('🚨 Final error message:', errorMessage);
      setFormError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2 className="section-header-lg">Create Invoice</h2>

      {(formError || invoiceError) && (
        <ErrorAlert error={formError || invoiceError} onDismiss={() => setFormError('')} />
      )}

      {/* Customer Details */}
      <h3 className="section-subheader">Customer Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="form-group">
          <label className="form-label form-label-required">Customer Name</label>
          <input
            type="text"
            value={formData.customer_name}
            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            className="input-field"
            placeholder="Enter customer name"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Phone Number</label>
          <input
            type="tel"
            value={formData.customer_phone}
            onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
            className="input-field"
            placeholder="Optional"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Drug License No</label>
          <input
            type="text"
            value={formData.customer_dl_number}
            onChange={(e) => setFormData({ ...formData, customer_dl_number: e.target.value })}
            className="input-field"
            placeholder="Optional DL number"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Customer Address</label>
          <textarea
            rows={2}
            value={formData.customer_address}
            onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
            className="input-field"
            placeholder="Enter customer address"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <input
            type="text"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="input-field"
            placeholder="Optional notes"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Discount (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={formData.discount_percent}
            onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
            className="input-field"
            placeholder="Optional discount percentage"
          />
        </div>
      </div>

      {/* Bill Items */}
      <h3 className="section-subheader divider-section">Bill Items (Products)</h3>
        
      {billItems.length === 0 ? (
        <div className="bg-gray-50 p-6 rounded-lg text-center mb-6">
          <p className="text-gray-500 mb-4">No items added. Click "Add Item" to start building the invoice.</p>
          <button
            type="button"
            onClick={handleAddItem}
            className="btn-primary"
          >
            + Add First Item
          </button>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {billItems.map((item, index) => {
            const selectedProduct = products.find(p => p.id === parseInt(item.product_id));
            // ✅ FILTER: Show only batches with quantity > 0
            const availableBatches = (selectedProduct?.batches || []).filter(b => b.quantity > 0);
            const itemTotal = item.quantity && item.selling_rate ? (parseInt(item.quantity) * parseFloat(item.selling_rate)).toFixed(2) : '0.00';

            return (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-semibold text-gray-700">Item #{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    ✕ Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="form-group">
                    <label className="form-label form-label-required text-xs">Product</label>
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

                  <div className="form-group">
                    <label className="form-label form-label-required text-xs">Batch</label>
                    <select
                      value={item.batch_number}
                      onChange={(e) => handleItemChange(index, 'batch_number', e.target.value)}
                      className="input-field text-sm"
                      disabled={!selectedProduct || availableBatches.length === 0}
                    >
                      <option value="">
                        {!selectedProduct ? 'Select product first' : availableBatches.length === 0 ? 'No batches available' : 'Select batch'}
                      </option>
                      {availableBatches.map((batch, bIdx) => (
                        <option key={bIdx} value={batch.batch_number}>
                          {batch.batch_number} (Qty: {batch.quantity})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label form-label-required text-xs">Quantity</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      className="input-field text-sm"
                      min="1"
                      placeholder="Qty"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label form-label-required text-xs">
                      Selling Rate (₹)
                      {item.selling_rate && item.original_selling_rate && 
                        Math.abs(parseFloat(item.selling_rate) - parseFloat(item.original_selling_rate)) > 0.01 && (
                          <span className="badge badge-warning ml-1 text-xs">EDITED</span>
                        )
                      }
                    </label>
                    <input
                      type="number"
                      value={item.selling_rate}
                      onChange={(e) => handleItemChange(index, 'selling_rate', e.target.value)}
                      className={`input-field text-sm ${
                        item.selling_rate && item.original_selling_rate && 
                        Math.abs(parseFloat(item.selling_rate) - parseFloat(item.original_selling_rate)) > 0.01
                          ? 'bg-amber-50 border-amber-300'
                          : ''
                      }`}
                      step="0.01"
                      min="0.01"
                      placeholder="Price"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label text-xs font-medium">Total (₹)</label>
                    <div className="input-field bg-green-50 border-green-300 text-lg font-bold text-green-700 flex items-center justify-center">
                      {itemTotal}
                    </div>
                  </div>
                </div>

                {/* Discount & GST Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
                  <div className="form-group">
                    <label className="form-label text-xs">Discount (%)</label>
                    <input
                      type="number"
                      value={item.discount_percent}
                      onChange={(e) => handleItemChange(index, 'discount_percent', e.target.value)}
                      className="input-field text-sm"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="Discount %"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label text-xs font-medium">
                      GST (%)
                      {item.gst_percent && item.hsn_code && (
                        <span className="text-green-600 ml-1">✓ From HSN</span>
                      )}
                    </label>
                    <select
                      value={item.gst_percent}
                      onChange={(e) => handleItemChange(index, 'gst_percent', e.target.value)}
                      className={`input-field text-sm ${
                        item.gst_percent && item.hsn_code ? 'bg-green-50 border-green-300' : ''
                      }`}
                    >
                      <option value="">Select GST</option>
                      <option value="0">0% (Exempted)</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>

                  <div className="form-group lg:col-span-2">
                    <label className="form-label text-xs font-medium">HSN/SAC Code</label>
                    <div className={`input-field text-sm flex items-center justify-center ${
                      item.hsn_code 
                        ? 'bg-blue-50 border-blue-300 font-semibold text-blue-700' 
                        : 'bg-gray-50 text-gray-500'
                    }`}>
                      {item.hsn_code ? `${item.hsn_code} ✓` : 'No HSN Code'}
                    </div>
                  </div>
                </div>
                
                {/* Return Section */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.is_return || false}
                        onChange={(e) => handleItemChange(index, 'is_return', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">Mark as Return</span>
                    </label>
                    
                    {item.is_return && (
                      <div className="flex-1">
                        <select
                          value={item.return_reason}
                          onChange={(e) => handleItemChange(index, 'return_reason', e.target.value)}
                          className="input-field text-sm"
                        >
                          <option value="">Select return reason</option>
                          <option value="Defective">Defective</option>
                          <option value="Expired">Expired</option>
                          <option value="Customer Request">Customer Request</option>
                          <option value="Wrong Item">Wrong Item</option>
                          <option value="Damaged Packaging">Damaged Packaging</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    )}
                  </div>
                  {item.is_return && (
                    <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">
                      ⚠️ This item will be marked as a return. Stock quantity will be refunded to inventory.
                    </div>
                  )}
                </div>

                {item.original_selling_rate && (
                  <div className="text-xs text-gray-500 mt-2">
                    Original Rate: ₹{parseFloat(item.original_selling_rate).toFixed(2)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {billItems.length > 0 && (
        <button
          type="button"
          onClick={handleAddItem}
          className="btn-secondary mb-6"
        >
          + Add Another Item
        </button>
      )}

      {/* Info Box */}
      <div className="alert alert-info mb-6">
        <strong>How it works:</strong><br/>
        ✓ Selling Rate auto-populated from batch (can be edited per bill)<br/>
        ✓ Edited rates shown with EDITED label<br/>
        ✓ Quantity deducted from selected batch<br/>
        ✓ Billing total = Quantity × Final Selling Rate<br/>
        ✓ Cost Price is internal only (not shown in invoices)
      </div>

      {/* Summary */}
      {billItems.length > 0 && (
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Invoice Summary:</span>
            <div className="text-right">
              <div className="text-sm text-gray-600">Total Items: <span className="font-semibold">{billItems.length}</span></div>
              <div className="text-2xl font-bold text-green-600">
                ₹{billItems.reduce((sum, item) => sum + (parseInt(item.quantity || 0) * parseFloat(item.selling_rate || 0)), 0).toFixed(2)}
              </div>
              <span className="text-xs text-gray-500">(Calculated before backend confirmation)</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || billItems.length === 0}
          className="btn-primary"
        >
          {loading ? '⏳ Creating...' : '✓ Create Invoice'}
        </button>
        {billItems.length === 0 && (
          <span className="text-sm text-gray-500 py-2">Add items to create an invoice</span>
        )}
      </div>
    </form>
  );
};

export default BillingForm;
