import React, { useState, useEffect } from 'react';
import { useProducts } from '../../context/ProductContext';
import { useWholesalers } from '../../context/WholesalersContext';
import WholesalersManager from '../Wholesalers/WholesalersManager';
import ErrorAlert from '../Common/ErrorAlert';


const AddProductForm = ({ onProductAdded, editingProduct }) => {
  // ✅ REMOVED: productTypes, fetchProductTypes, typesLoading — no longer needed
  const { addProduct, updateProduct, error, hsns, fetchHSNs } = useProducts();
  const { selectedWholesalerId, setSelectedWholesalerId, recordPurchase, wholesalers } = useWholesalers();
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  // ✅ REMOVED: typesLoading state
  const [hsnLoading, setHsnLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    // ✅ REMOVED: product_type field
    hsn: null,
    manufacturer: '',
    min_stock_level: '',
    unit: 'PCS',
    description: '',
    batches: [],
  });
  const isEditMode = Boolean(formData?.id);
  const [batchForm, setBatchForm] = useState({
    mrp: '',
    quantity: '',
  });

  // ✅ REMOVED: fetchProductTypes() from this effect
  useEffect(() => {
    const loadData = async () => {
      try {
        setHsnLoading(true);
        await fetchHSNs();
      } catch (err) {
        console.error('Failed to load HSN codes:', err);
      } finally {
        setHsnLoading(false);
      }
    };
    loadData();
  }, [fetchHSNs]);

  // 🔁 Prefill form when editing a product
  useEffect(() => {
    if (editingProduct) {
      setFormData({
        id: editingProduct.id,
        name: editingProduct.name || '',
        // ✅ REMOVED: product_type field
        hsn: editingProduct.hsn || null,
        manufacturer: editingProduct.manufacturer || '',
        min_stock_level: editingProduct.min_stock_level ?? editingProduct.minStockAlert ?? '',
        unit: editingProduct.unit || 'PCS',
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


    if (!selectedWholesalerId && !isEditMode) {
      setFormError('Please select wholesaler before adding product batches');
      return;
    }


    const newBatch = {
      mrp: parseFloat(batchForm.mrp),
      selling_rate: parseFloat(batchForm.mrp), // selling_rate = MRP by default, discount applied at billing
      cost_price: 0,
      quantity: parseInt(batchForm.quantity),
      expiry_date: null,
      wholesaler_id: selectedWholesalerId,
    };

    setFormData(prev => ({
      ...prev,
      batches: [...prev.batches, newBatch]
    }));

    setBatchForm({
      mrp: '',
      quantity: '',
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
      // ✅ FIXED: removed product_type from required field check
      if (!formData.name) {
        throw new Error('Product name is required');
      }

      if (formData.min_stock_level !== '' && formData.min_stock_level !== null) {
        const ms = Number(formData.min_stock_level);
        if (!Number.isFinite(ms) || ms < 0) {
          throw new Error('Minimum Stock Alert cannot be negative');
        }
      }

      if (formData.batches.length === 0) {
        throw new Error('At least one batch is required');
      }

      const payload = {
        ...formData,
        name: formData.name.trim(),
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

      // ✅ FIXED: reset form no longer includes product_type, generic_name, salt_composition
      if (!isEditMode) {
        setFormData({
          name: '',
          hsn: null,
          manufacturer: '',
          min_stock_level: '',
          unit: 'PCS',
          description: '',
          batches: [],
        });
        setBatchForm({
          mrp: '',
          quantity: '',
        });
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

      {/* ✅ Step 2: Product Details — Product Type field REMOVED */}
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
            placeholder="e.g., Copper Wire 1.5mm"
          />
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
          <label className="form-label">Manufacturer</label>
          <input
            type="text"
            name="manufacturer"
            value={formData.manufacturer}
            onChange={handleChange}
            className="input-field"
            placeholder="e.g., Havells, Finolex, Polycab"
          />
        </div>

        <div>
          <label className="form-label">Unit</label>
          <select
            name="unit"
            value={formData.unit}
            onChange={handleChange}
            className="input-field"
          >
            <option value="PCS">PCS - Pieces</option>
            <option value="PKT">PKT - Packet</option>
            <option value="BOX">BOX - Box</option>
            <option value="ROLL">ROL - Roll</option>
            <option value="MTR">MTR - Meter</option>
            <option value="KG">KG - Kilogram</option>
            <option value="SET">SET - Set</option>
            <option value="PAIR">PAIR - Pair</option>
            <option value="BUNDLE">BUNDLE - Bundle</option>
          </select>
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
          </div>

          <button
            onClick={handleAddBatch}
            type="button"
            className="btn-primary"
          >
            + Add Batch
          </button>

        </div>

        {/* Batches List */}
        {formData.batches.length > 0 && (
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <h4 className="font-semibold mb-4 text-gray-900">
              Batches Added{' '}
              <span className="badge badge-success ml-2">{formData.batches.length}</span>
            </h4>
            <div className="space-y-3">
              {formData.batches.map((batch, index) => (
                <div
                  key={index}
                  className="p-4 bg-white border-l-4 border-green-600 rounded space-y-3"
                >
                  

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                  </div>

                  <div className="text-sm text-gray-600 grid grid-cols-2 md:grid-cols-3 gap-2">
                    <div><strong>MRP:</strong> ₹{batch.mrp}</div>
                    <div><strong>Unit:</strong> {formData.unit}</div>
                  </div>

                  {batch.wholesaler_id && (
                    <div className="text-sm text-purple-600 font-medium">
                      📦 Wholesaler: {wholesalers.find(w => w.id === batch.wholesaler_id)?.name || 'Unknown'}
                    </div>
                  )}

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