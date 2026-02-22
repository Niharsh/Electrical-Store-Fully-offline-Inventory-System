import React, { useState, useEffect } from 'react';
import { useProducts } from '../../context/ProductContext';
import { useWholesalers } from '../../context/WholesalersContext';
import WholesalersManager from '../Wholesalers/WholesalersManager';
import ErrorAlert from '../Common/ErrorAlert';


const AddProductForm = ({ onProductAdded, editingProduct }) => {
  const { addProduct, updateProduct, error, productTypes, hsns, fetchProductTypes, fetchHSNs } = useProducts();
  const { selectedWholesalerId, setSelectedWholesalerId, recordPurchase, getLastPurchasePrice, wholesalers } = useWholesalers();
  const [formError, setFormError] = useState('');
  const [priceComparisonMsg, setPriceComparisonMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [typesLoading, setTypesLoading] = useState(true);
  const [hsnLoading, setHsnLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    product_type: 'tablet',
    hsn: null,
    generic_name: '',
    manufacturer: '',
    salt_composition: '',
    // Minimum stock alert (optional). If empty => treated as 10 by backend.
    min_stock_level: '',
    unit: 'pc',
    description: '',
    batches: [], // Array of batch objects
  });
  const isEditMode = Boolean(formData?.id);
  const [batchForm, setBatchForm] = useState({
    batch_number: '',
    mrp: '',
    selling_rate: '',
    cost_price: '',
    quantity: '',
    expiry_date: '',
  });

  // Load product types and HSN codes on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setTypesLoading(true);
        setHsnLoading(true);
        await Promise.all([
          fetchProductTypes(),
          fetchHSNs(),
        ]);
      } catch (err) {
        console.error('Failed to load product types or HSN codes:', err);
      } finally {
        setTypesLoading(false);
        setHsnLoading(false);
      }
    };
    loadData();
  }, [fetchProductTypes, fetchHSNs]);

  // 🔁 Prefill form when editing a product
  useEffect(() => {
    if (editingProduct) {
      setFormData({
        id: editingProduct.id,
        name: editingProduct.name || '',
        product_type: editingProduct.product_type || 'tablet',
        hsn: editingProduct.hsn || null,
        generic_name: editingProduct.generic_name || '',
        manufacturer: editingProduct.manufacturer || '',
        salt_composition: editingProduct.salt_composition || '',
        min_stock_level: editingProduct.min_stock_level ?? editingProduct.minStockAlert ?? '',
        unit: editingProduct.unit || 'pc',
        description: editingProduct.description || '',
        batches: editingProduct.batches || [],
      });
        if (editingProduct.batches?.length > 0) {
        setSelectedWholesalerId(editingProduct.batches[0].wholesaler_id);
      }
    }
  }, [editingProduct]);


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
    setPriceComparisonMsg('');

    // Validate wholesaler selection
    if (!selectedWholesalerId && !isEditMode) {
      setFormError('Please select wholesaler before adding product batches');
      return;
    }

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
    if (!batchForm.cost_price || parseFloat(batchForm.cost_price) <= 0) {
      setFormError('Cost price must be greater than 0');
      return;
    }

    const quantity = Number(batchForm.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setFormError('Quantity must be a whole number');
      return;
    }

    if (parseFloat(batchForm.selling_rate) > parseFloat(batchForm.mrp)) {
      setFormError('Selling rate cannot be greater than MRP');
      return;
    }
    if (!batchForm.expiry_date) {
      setFormError('Expiry date is required');
      return;
    }



    // Check for duplicate batch number
    if (
      formData.batches.find(
        b =>
          b.batch_number === batchForm.batch_number.trim() &&
          b.wholesaler_id === selectedWholesalerId
        )
      ) {
          setFormError('This batch already exists for the selected wholesaler');
          return;
        }

    // Check for price differences from previous purchases of this product from same wholesaler
    const lastPurchase = getLastPurchasePrice(selectedWholesalerId, formData.name.trim());
    if (lastPurchase && Math.abs(lastPurchase.costPrice - parseFloat(batchForm.cost_price)) > 0.01) {
      setPriceComparisonMsg(
        `ℹ️ Note: On ${new Date(lastPurchase.purchaseDate).toLocaleDateString()}, you purchased this product at ₹${lastPurchase.costPrice.toFixed(2)}`
      );
    }

    // Add batch to product
    const newBatch = {
      batch_number: batchForm.batch_number.trim(),
      mrp: parseFloat(batchForm.mrp),
      selling_rate: parseFloat(batchForm.selling_rate),
      cost_price: parseFloat(batchForm.cost_price),
      quantity: parseInt(batchForm.quantity),
      expiry_date: batchForm.expiry_date || null,
      wholesaler_id: selectedWholesalerId,
      // purchase_date: new Date().toISOString().split('T')[0],
    };

    setFormData(prev => ({
      ...prev,
      batches: [...prev.batches, newBatch]
    }));

    // Reset batch form fields
    setBatchForm({
      batch_number: '',
      mrp: '',
      selling_rate: '',
      cost_price: '',
      quantity: '',
      expiry_date: '',
    });
  };

  // Remove batch from product
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

      // Validate minimum stock alert if provided
      if (formData.min_stock_level !== '' && formData.min_stock_level !== null) {
        const ms = Number(formData.min_stock_level);
        if (!Number.isFinite(ms) || ms < 0) {
          throw new Error('Minimum Stock Alert cannot be negative');
        }
      }

      if (formData.batches.length === 0) {
        throw new Error('At least one batch is required');
      }

      // Create payload with batches
      const payload = {
        ...formData,
        name: formData.name.trim(),
        // Ensure min_stock_level is a number and fallback to 10 when empty or invalid
        min_stock_level: (() => {
          const v = formData.min_stock_level;
          if (v === null || v === undefined || String(v).trim() === '') return 10;
          const n = Number(v);
          return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 10;
        })(),
      };
      console.log('📤 AddProductForm: Sending payload with', payload.batches.length, 'batches:', payload);

      let savedProduct;

      if (isEditMode) {
        savedProduct = await updateProduct(formData.id, payload);
      } else {
        savedProduct = await addProduct(payload);
      }
  
      console.log('✅ Product saved:', savedProduct);

      console.log('✅ AddProductForm: Product saved successfully:', savedProduct);
      
      
      // Record purchases in wholesaler context for each batch
      formData.batches.forEach(batch => {
        if (batch.wholesaler_id) {
          recordPurchase(
            batch.wholesaler_id,
            formData.name.trim(),
            batch.cost_price,
            batch.purchase_date
          );
        }
      });
      
      // Reset form
      if (!isEditMode) {
        setFormData({
          name: '',
          product_type: 'tablet',
          hsn: null,
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
          selling_rate: '',
          cost_price: '',
          quantity: '',
          expiry_date: '',
        });
        setPriceComparisonMsg('');
      }


      if (onProductAdded) {
        onProductAdded(savedProduct);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2 className="section-header-lg">
        {editingProduct ? 'Edit Product' : 'Add New Product'}
      </h2>


      {(formError || error) && (
        <ErrorAlert error={formError || error} onDismiss={() => setFormError('')} />
      )}

      {/* Wholesaler Manager Section */}
      <div className="mb-8 p-5 bg-purple-50 border-l-4 border-purple-600 rounded-lg">
        <h3 className="section-subheader text-purple-900">Step 1: Select Wholesaler</h3>
        <WholesalersManager disabled={isEditMode} />
        {!selectedWholesalerId && (
          <div className="alert alert-warning mt-3">
            ⚠️ Please select a wholesaler before adding product batches
          </div>
        )}
      </div>

      <h3 className="section-subheader divider-section">Step 2: Product Details</h3>
      <div className="grid-cols-form">
        <div>
          <label className="form-label form-label-required">Product Name</label>
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
          <label className="form-label form-label-required">Product Type</label>
          {typesLoading ? (
            <div className="input-field bg-gray-100 text-gray-500 py-2.5">Loading types...</div>
          ) : (
            <select
              name="product_type"
              value={formData.product_type}
              onChange={handleChange}
              className="input-field"
            >
              <option value="">-- Select Product Type --</option>
              {productTypes.map(type => (
                <option key={type.name} value={type.name}>
                  {type.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="form-label">HSN Code (for GST)</label>
          {hsnLoading ? (
            <div className="input-field bg-gray-100 text-gray-500 py-2.5">Loading HSN codes...</div>
          ) : (
            <select
              name="hsn"
              value={formData.hsn || ''}
              onChange={(e) => {
                const selectedCode = e.target.value;
                setFormData(prev => ({
                  ...prev,
                  hsn: selectedCode ? selectedCode : null
                }));
              }}
              className="input-field"
            >
              <option value="">-- No HSN Code --</option>
              {hsns.map(hsn => (
                <option key={hsn.hsn_code} value={hsn.hsn_code}>
                  {hsn.hsn_code} - {hsn.description} ({hsn.gst_rate}% GST)
                </option>
              ))}
            </select>
          )}
          {formData.hsn && (
            <div className="text-sm text-green-700 mt-1">
              ✅ Selected HSN will apply {hsns.find(h => h.hsn_code === formData.hsn)?.gst_rate}% GST during billing
            </div>
          )}
        </div>

        <div>
          <label className="form-label">Generic Name</label>
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
          <label className="form-label">Manufacturer</label>
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
            <label className="form-label">Salt/Composition</label>
            <input
              type="text"
              name="salt_composition"
              value={formData.salt_composition}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g., Paracetamol 500mg"
            />
          </div>
        )}

        <div>
          <label className="form-label">Unit</label>
          <input
            type="text"
            name="unit"
            value={formData.unit}
            onChange={handleChange}
            className="input-field"
            placeholder="e.g., pc, bottle, gm, ml"
          />
        </div>

        <div>
          <label className="form-label">Minimum Stock Alert</label>
          <input
            type="number"
            name="min_stock_level"
            value={formData.min_stock_level}
            onChange={handleChange}
            className="input-field"
            min="0"
            placeholder="Default: 10"
          />
          <p className="text-sm text-gray-500 mt-1">Leave empty to use default minimum (10).</p>
        </div>

        <div className="lg:col-span-3">
          <label className="form-label">Description</label>
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
      <div className="divider-section">
        <h3 className="section-subheader">Step 3: Add Batches to This Product</h3>
        
        {formError && formData.batches.length === 0 && (
          <div className="alert alert-danger">
            {formError}
          </div>
        )}

        {/* Batch Form */}
        <div className="card-compact bg-blue-50 border border-blue-200 mb-6">
          <h4 className="font-semibold mb-4 text-blue-900">New Batch</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div className="form-group">
              <label className="form-label form-label-required">Batch Number</label>
              <input
                type="text"
                name="batch_number"
                value={batchForm.batch_number}
                onChange={handleBatchChange}
                className="input-field"
                placeholder="e.g., LOT-2024-001"
              />
            </div>

            <div className="form-group">
              <label className="form-label form-label-required">MRP (₹)</label>
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

            <div className="form-group">
              <label className="form-label form-label-required">Selling Rate (₹)</label>
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

            <div className="form-group">
              <label className="form-label form-label-required">Cost Price (₹)</label>
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

            <div className="form-group">
              <label className="form-label form-label-required">Quantity</label>
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

            <div className="form-group">
              <label className="form-label">Expiry Date</label>
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
            className="btn-primary"
          >
            + Add Batch
          </button>

          {priceComparisonMsg && (
            <div className="alert alert-info mt-4">
              {priceComparisonMsg}
            </div>
          )}
        </div>

        {/* Batches List */}
        {formData.batches.length > 0 && (
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <h4 className="font-semibold mb-4 text-gray-900">Batches Added <span className="badge badge-success ml-2">{formData.batches.length}</span></h4>
            <div className="space-y-3">
              {formData.batches.map((batch, index) => (
                <div
                  key={index}
                  className="p-4 bg-white border-l-4 border-green-600 rounded space-y-3"
                >
                
                  {/* Batch number (READ ONLY) */}
                  <div className="font-semibold text-gray-900">
                    Batch: {batch.batch_number}
                  </div>

                  {/* Editable fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                    {/* Selling Rate */}
                    <div>
                      <label className="text-sm font-medium">Selling Rate (₹)</label>
                      <input
                        type="number"
                        value={batch.selling_rate}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          setFormData(prev => ({
                            ...prev,
                            batches: prev.batches.map((b, i) =>
                              i === index ? { ...b, selling_rate: value } : b
                            )
                          }));
                        }}
                        className="input-field"
                      />
                    </div>
                      
                    {/* Quantity */}
                    <div>
                      <label className="text-sm font-medium">Quantity</label>
                      <input
                        type="number"
                        value={batch.quantity}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          setFormData(prev => ({
                            ...prev,
                            batches: prev.batches.map((b, i) =>
                              i === index ? { ...b, quantity: value } : b
                            )
                          }));
                        }}
                        className="input-field"
                      />
                    </div>
                      
                    {/* Expiry Date */}
                    <div>
                      <label className="text-sm font-medium">Expiry Date</label>
                      <input
                        type="date"
                        value={batch.expiry_date || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            batches: prev.batches.map((b, i) =>
                              i === index ? { ...b, expiry_date: value } : b
                            )
                          }));
                        }}
                        className="input-field"
                      />
                    </div>
                  </div>
                      
                  {/* Static info */}
                  <div className="text-sm text-gray-600 grid grid-cols-2 md:grid-cols-3 gap-2">
                    <div><strong>MRP:</strong> ₹{batch.mrp}</div>
                    <div><strong>Cost:</strong> ₹{batch.cost_price}</div>
                    <div><strong>Unit:</strong> {formData.unit}</div>
                  </div>
                      
                  {/* Wholesaler */}
                  {batch.wholesaler_id && (
                    <div className="text-sm text-purple-600 font-medium">
                      📦 Wholesaler: {wholesalers.find(w => w.id === batch.wholesaler_id)?.name || 'Unknown'}
                    </div>
                  )}

                  {/* Delete batch */}
                  <button
                    onClick={() => handleRemoveBatch(index)}
                    type="button"
                    className="btn-danger btn-sm"
                  >
                    Delete Batch
                  </button>
                
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-8">
        <button
          type="submit"
          disabled={loading || formData.batches.length === 0}
          className="btn-primary"
        >
          {isEditMode ? '✓ Update Product' : '✓ Add Product'}
        </button>
        {formData.batches.length === 0 && (
          <span className="text-sm text-gray-500 py-2">Add at least one batch to continue</span>
        )}
      </div>
    </form>
  );
};

export default AddProductForm;
