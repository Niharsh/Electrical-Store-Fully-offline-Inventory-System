import React, { useEffect, useState, useCallback } from 'react';
import { useProducts } from '../../context/ProductContext';
import { useWholesalers } from '../../context/WholesalersContext';
import LoadingSpinner from '../Common/LoadingSpinner';
import ErrorAlert from '../Common/ErrorAlert';
import ProductAutocomplete from './ProductAutocomplete';

const ProductList = ({ onEdit, onDelete }) => {
  const { products, loading, error, fetchProducts } = useProducts();
  const { getProductPurchaseHistory, wholesalers } = useWholesalers();
  const [expandedBatches, setExpandedBatches] = useState({});

  // Initial fetch on component mount (runs ONLY once)
  useEffect(() => {
    fetchProducts();
  }, []);

  // Handle product selection from autocomplete dropdown
  const handleSelectProduct = (product) => {
    console.log('✅ Product selected from autocomplete:', product.name);
    if (onEdit) {
      onEdit(product);
    }
  };

  if (loading) return <LoadingSpinner />;

  // ✅ REMOVED: formatProductType() — no longer needed

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate total quantity from all batches
  const getTotalQuantity = (batches) => {
    if (!batches || !Array.isArray(batches)) {
      console.log('⚠️ getTotalQuantity: No batches found');
      return 0;
    }
    const total = batches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
    console.log(`📦 getTotalQuantity: Calculated total ${total} from ${batches.length} batches`);
    return total;
  };

  // Get min MRP from all batches
  const getMinMRP = (batches) => {
    if (!batches || !Array.isArray(batches)) return null;
    const mrps = batches.map(b => parseFloat(b.mrp)).filter(m => m > 0);
    return mrps.length > 0 ? Math.min(...mrps) : null;
  };

  // Get max MRP from all batches
  const getMaxMRP = (batches) => {
    if (!batches || !Array.isArray(batches)) return null;
    const mrps = batches.map(b => parseFloat(b.mrp)).filter(m => m > 0);
    return mrps.length > 0 ? Math.max(...mrps) : null;
  };

  // Toggle batch details view
  const toggleBatches = (productId) => {
    setExpandedBatches(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  return (
    <div className="card">
      <h2 className="section-header">Product Inventory</h2>

      {/* Search Bar with Autocomplete */}
      <ProductAutocomplete
        products={products}
        onSelectProduct={handleSelectProduct}
        isLoading={false}
        resultsCount={0}
      />

      {error && <ErrorAlert error={error} />}

      {loading ? (
        <LoadingSpinner />
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No products found. Add one to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="table-header">
              <tr>
                <th className="table-body w-10"></th>
                <th className="table-body">Product Name</th>
                {/* ✅ REMOVED: Type column header */}
                <th className="table-body text-right">Total Qty</th>
                <th className="table-body text-center">MRP Range</th>
                <th className="table-body text-center">Batches</th>
                <th className="table-body text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, idx) => {
                if (!product || !product.id || !product.name) {
                  return null;
                }
                const totalQty = getTotalQuantity(product.batches);
                const minMrp = getMinMRP(product.batches);
                const maxMrp = getMaxMRP(product.batches);
                const isExpanded = expandedBatches[product.id];

                return (
                  <React.Fragment key={product.id}>
                    <tr className="table-row">
                      <td className="table-body text-center">
                        <button
                          onClick={() => toggleBatches(product.id)}
                          className="text-sky-600 hover:text-sky-800 font-bold text-lg w-6 h-6 flex items-center justify-center"
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="table-body">
                        <div className="font-semibold text-gray-900">{product.name}</div>
                      </td>
                      {/* ✅ REMOVED: Type column cell */}
                      <td className="table-body text-right font-semibold text-lg">{totalQty}</td>
                      <td className="table-body text-center">
                        {minMrp ? (
                          <div className="text-sm">
                            {minMrp === maxMrp ? (
                              <span className="font-medium">₹{minMrp.toFixed(2)}</span>
                            ) : (
                              <span className="font-medium">
                                ₹{minMrp.toFixed(2)} - ₹{maxMrp.toFixed(2)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="table-body text-center">
                        <span className="badge badge-success">
                          {product.batches?.length || 0}
                        </span>
                      </td>
                      <td className="table-body text-center space-x-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onEdit?.(product);
                          }}
                          className="btn-secondary btn-sm text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete?.(product.id);
                          }}
                          className="btn-danger btn-sm text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>

                    {/* Batch Details Row */}
                    {isExpanded && product.batches && product.batches.length > 0 && (
                      <tr className="bg-gray-50">
                        {/* ✅ FIXED: colSpan 8 → 7 (one column removed) */}
                        <td colSpan="7" className="py-4">
                          <div className="ml-8">
                            <h4 className="font-semibold mb-4 text-gray-900">Batch Details</h4>
                            <div className="space-y-3">
                              {product.batches.map((batch, idx) => (
                                <div
                                  key={batch.id || `${product.id}-${batch.batch_number}`}
                                  className="p-4 bg-white border-l-4 border-sky-600 rounded-lg"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="font-semibold text-gray-900">
                                        {batch.batch_number}
                                      </div>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm text-gray-600">
                                        <div><span className="font-medium">MRP:</span> ₹{parseFloat(batch.mrp).toFixed(2)}</div>
                                        <div><span className="font-medium">Selling:</span> ₹{parseFloat(batch.selling_rate).toFixed(2)}</div>
                                        <div><span className="font-medium">Cost:</span> ₹{parseFloat(batch.cost_price).toFixed(2)}</div>
                                        <div><span className="font-medium">Qty:</span> {batch.quantity} {product.unit}</div>
                                        {batch.expiry_date && (
                                          <div><span className="font-medium">Expiry:</span> {formatDate(batch.expiry_date)}</div>
                                        )}
                                      </div>
                                      {batch.wholesaler_id && (
                                        <div className="text-sm text-purple-600 font-medium mt-3">
                                          📦 Wholesaler: {wholesalers.find(w => w.id === batch.wholesaler_id)?.name || 'Unknown'}
                                        </div>
                                      )}
                                      {batch.purchase_date && (
                                        <div className="text-xs text-gray-500 mt-2">
                                          Purchased: {formatDate(batch.purchase_date)}
                                        </div>
                                      )}
                                      {/* Purchase History Section */}
                                      {product.name && (
                                        (() => {
                                          const purchaseHistory = getProductPurchaseHistory(product.name);
                                          return purchaseHistory && purchaseHistory.length > 0 ? (
                                            <div className="mt-3 pt-3 border-t border-gray-200">
                                              <div className="text-xs font-semibold text-gray-700 mb-2">
                                                Purchase History from {wholesalers.find(w => w.id === batch.wholesaler_id)?.name || 'this wholesaler'}:
                                              </div>
                                              <div className="space-y-1">
                                                {purchaseHistory
                                                  .filter(h => h.wholesalerId === batch.wholesaler_id)
                                                  .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))
                                                  .map((record) => (
                                                    <div key={record.id} className="text-xs text-gray-600">
                                                      ₹{record.costPrice.toFixed(2)} on {formatDate(record.purchaseDate)}
                                                    </div>
                                                  ))}
                                              </div>
                                            </div>
                                          ) : null;
                                        })()
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {isExpanded && (!product.batches || product.batches.length === 0) && (
                      <tr className="bg-gray-50">
                        {/* ✅ FIXED: colSpan 8 → 7 */}
                        <td colSpan="7" className="py-4 text-center text-gray-500">
                          No batches found
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProductList;