import React, { useState, useEffect } from 'react';
import { useProducts } from '../../context/ProductContext';
import ErrorAlert from '../Common/ErrorAlert';

const AddProductForm = ({ onProductAdded }) => {
  const { addProduct, error, productTypes, fetchProductTypes } = useProducts();
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [typesLoading, setTypesLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    product_type: 'tablet',
    generic_name: '',
    manufacturer: '',
    salt_composition: '',
    unit: 'pc',
    description: '',
    batches: [], // Array of batch objects
  });
  const [batchForm, setBatchForm] = useState({
    batch_number: '',
    mrp: '',
    selling_rate: '',
    cost_price: '',
    quantity: '',
    expiry_date: '',
  });

  // Load product types on component mount
  useEffect(() => {
    const loadTypes = async () => {
      try {
        setTypesLoading(true);
        await fetchProductTypes();
      } catch (err) {
        console.error('Failed to load product types:', err);
      } finally {
        setTypesLoading(false);
      }
    };
    loadTypes();
  }, [fetchProductTypes]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleBatchChange = (e) => {
    const { name, value } = e.target;
    setBatchForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddBatch = (e) => {
    e.preventDefault();
    setFormError('');

    // Validate batch fields
    if (!batchForm.batch_number.trim()) {
      setFormError('Batch number is required');
      return;
    }
    if (!batchForm.mrp || parseFloat(batchForm.mrp) <= 0) {
      setFormError('Valid MRP is required');
      return;
    }
    if (!batchForm.selling_rate || parseFloat(batchForm.selling_rate) <= 0) {
      setFormError('Valid Selling Rate is required');
      return;
    }
    if (!batchForm.cost_price || parseFloat(batchForm.cost_price) < 0) {
      setFormError('Valid Cost Price is required');
      return;
    }
    if (!batchForm.quantity || parseInt(batchForm.quantity) <= 0) {
      setFormError('Quantity must be greater than 0');
      return;
    }

    // Check for duplicate batch number
    if (formData.batches.find(b => b.batch_number === batchForm.batch_number.trim())) {
      setFormError('Batch number already exists for this product');
      return;
    }

    // Add batch to product
    const newBatch = {
      batch_number: batchForm.batch_number.trim(),
      mrp: parseFloat(batchForm.mrp),
      selling_rate: parseFloat(batchForm.selling_rate),
      cost_price: parseFloat(batchForm.cost_price),
      quantity: parseInt(batchForm.quantity),
      expiry_date: batchForm.expiry_date || null,
    };

    setFormData(prev => ({
      ...prev,
      batches: [...prev.batches, newBatch]
    }));

    // Reset batch form
    setBatchForm({
      batch_number: '',
      mrp: '',
      selling_rate: '',
      cost_price: '',
      quantity: '',
      expiry_date: '',
    });
  };

  const handleRemoveBatch = (index) => {
    setFormData(prev => ({
      ...prev,
      batches: prev.batches.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.name || !formData.product_type) {
        throw new Error('Product name and type are required');
      }

      if (formData.batches.length === 0) {
        throw new Error('At least one batch is required');
      }

      // Create payload with batches
      const payload = {
        ...formData,
        name: formData.name.trim(),
      };

      const newProduct = await addProduct(payload);
      
      // Reset form
      setFormData({
        name: '',
        product_type: 'tablet',
        generic_name: '',
        manufacturer: '',
        salt_composition: '',
        unit: 'pc',
        description: '',
        batches: [],
      });
      setBatchForm({
        batch_number: '',
        mrp: '',
        quantity: '',
        expiry_date: '',
      });

      if (onProductAdded) {
        onProductAdded(newProduct);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Add New Product</h2>

      {(formError || error) && (
        <ErrorAlert error={formError || error} onDismiss={() => setFormError('')} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block font-semibold mb-2">Product Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="input-field"
            placeholder="e.g., Aspirin 500mg"
          />
        </div>

        <div>
          <label className="block font-semibold mb-2">Product Type *</label>
          {typesLoading ? (
            <div className="input-field bg-gray-100 text-gray-500">Loading types...</div>
          ) : (
            <select
              name="product_type"
              value={formData.product_type}
              onChange={handleChange}
              className="input-field"
            >
              <option value="">-- Select Product Type --</option>
              {productTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block font-semibold mb-2">Generic Name</label>
          <input
            type="text"
            name="generic_name"
            value={formData.generic_name}
            onChange={handleChange}
            className="input-field"
            placeholder="e.g., Acetylsalicylic Acid"
          />
        </div>

        <div>
          <label className="block font-semibold mb-2">Manufacturer</label>
          <input
            type="text"
            name="manufacturer"
            value={formData.manufacturer}
            onChange={handleChange}
            className="input-field"
            placeholder="e.g., Pharma Ltd"
          />
        </div>

        {(formData.product_type === 'tablet' || formData.product_type === 'capsule') && (
          <div>
            <label className="block font-semibold mb-2">Salt/Composition (Optional)</label>
            <input
              type="text"
              name="salt_composition"
              value={formData.salt_composition}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g., Paracetamol 500mg, Amoxicillin 500mg + Clavulanic Acid 125mg"
            />
          </div>
        )}

        <div>
          <label className="block font-semibold mb-2">Unit</label>
          <input
            type="text"
            name="unit"
            value={formData.unit}
            onChange={handleChange}
            className="input-field"
            placeholder="e.g., pc, bottle, gm, ml"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block font-semibold mb-2">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="input-field resize-none"
            rows="3"
            placeholder="Add notes about the product"
          />
        </div>
      </div>

      {/* Batch Management Section */}
      <div className="mt-8 pt-6 border-t-2 border-gray-200">
        <h3 className="text-xl font-semibold mb-4">Add Batches to This Product</h3>
        
        {formError && formData.batches.length === 0 && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {formError}
          </div>
        )}

        {/* Batch Form */}
        <div className="card bg-blue-50 mb-6">
          <h4 className="font-semibold mb-4">New Batch</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block font-semibold mb-2">Batch Number *</label>
              <input
                type="text"
                name="batch_number"
                value={batchForm.batch_number}
                onChange={handleBatchChange}
                className="input-field"
                placeholder="e.g., LOT-2024-001"
              />
            </div>

            <div>
              <label className="block font-semibold mb-2">MRP (₹) *</label>
              <input
                type="number"
                name="mrp"
                value={batchForm.mrp}
                onChange={handleBatchChange}
                className="input-field"
                step="0.01"
                min="0"
                placeholder="Printed on product"
              />
            </div>

            <div>
              <label className="block font-semibold mb-2">Selling Rate (₹) *</label>
              <input
                type="number"
                name="selling_rate"
                value={batchForm.selling_rate}
                onChange={handleBatchChange}
                className="input-field"
                step="0.01"
                min="0"
                placeholder="Your selling price"
              />
            </div>

            <div>
              <label className="block font-semibold mb-2">Cost Price (₹) *</label>
              <input
                type="number"
                name="cost_price"
                value={batchForm.cost_price}
                onChange={handleBatchChange}
                className="input-field"
                step="0.01"
                min="0"
                placeholder="Purchase price"
              />
            </div>

            <div>
              <label className="block font-semibold mb-2">Quantity *</label>
              <input
                type="number"
                name="quantity"
                value={batchForm.quantity}
                onChange={handleBatchChange}
                className="input-field"
                min="0"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block font-semibold mb-2">Expiry Date (Optional)</label>
              <input
                type="date"
                name="expiry_date"
                value={batchForm.expiry_date}
                onChange={handleBatchChange}
                className="input-field"
              />
            </div>
          </div>

          <button
            onClick={handleAddBatch}
            type="button"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
          >
            + Add Batch
          </button>
        </div>

        {/* Batches List */}
        {formData.batches.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Batches Added ({formData.batches.length})</h4>
            <div className="space-y-2">
              {formData.batches.map((batch, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded"
                >
                  <div>
                    <div className="font-semibold">{batch.batch_number}</div>
                    <div className="text-sm text-gray-600">
                      MRP: ₹{parseFloat(batch.mrp).toFixed(2)} | Selling: ₹{parseFloat(batch.selling_rate).toFixed(2)} | Cost: ₹{parseFloat(batch.cost_price).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">
                      Qty: {batch.quantity} {formData.unit}
                      {batch.expiry_date && ` | Expiry: ${new Date(batch.expiry_date).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveBatch(index)}
                    type="button"
                    className="text-red-600 hover:text-red-800 font-semibold text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || formData.batches.length === 0}
        className="btn-primary mt-6 w-full md:w-auto"
      >
        {loading ? 'Adding...' : 'Add Product'}
      </button>
    </form>
  );
};

export default AddProductForm;
