import React, { useEffect, useState } from 'react';
import { useProducts } from '../../context/ProductContext';
import LoadingSpinner from '../Common/LoadingSpinner';
import ErrorAlert from '../Common/ErrorAlert';

const ProductList = ({ onEdit, onDelete }) => {
  const { products, loading, error, fetchProducts } = useProducts();
  const [expandedBatches, setExpandedBatches] = useState({});

  useEffect(() => {
    fetchProducts();
  }, []);

  if (loading) return <LoadingSpinner />;

  // Format product type for display
  const formatProductType = (type) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

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
    if (!batches || !Array.isArray(batches)) return 0;
    return batches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
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
      <h2 className="text-2xl font-bold mb-6">Product Inventory</h2>

      {error && <ErrorAlert error={error} />}

      {products.length === 0 ? (
        <p className="text-gray-600 text-center py-8">No products found. Add one to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3"></th>
                <th className="text-left py-3">Name</th>
                <th className="text-left py-3">Type</th>
                <th className="text-left py-3">Generic</th>
                <th className="text-right py-3">Total Qty</th>
                <th className="text-center py-3">MRP Range</th>
                <th className="text-center py-3">Batches</th>
                <th className="text-center py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => {
                const totalQty = getTotalQuantity(product.batches);
                const minMrp = getMinMRP(product.batches);
                const maxMrp = getMaxMRP(product.batches);
                const isExpanded = expandedBatches[product.id];

                return (
                  <React.Fragment key={product.id}>
                    <tr className="table-row">
                      <td className="py-4 text-center">
                        <button
                          onClick={() => toggleBatches(product.id)}
                          className="text-blue-600 hover:text-blue-800 font-bold text-lg"
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="py-4">
                        <div className="font-semibold">{product.name}</div>
                        {product.salt_composition && (
                          <div className="text-xs text-gray-500 mt-1">
                            Salt: {product.salt_composition}
                          </div>
                        )}
                      </td>
                      <td className="py-4">
                        <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                          {formatProductType(product.product_type)}
                        </span>
                      </td>
                      <td className="py-4 text-gray-600">{product.generic_name || '-'}</td>
                      <td className="py-4 text-right font-semibold">{totalQty}</td>
                      <td className="py-4 text-center">
                        {minMrp ? (
                          <div className="text-sm">
                            {minMrp === maxMrp ? (
                              <span>₹{minMrp.toFixed(2)}</span>
                            ) : (
                              <span>₹{minMrp.toFixed(2)} - ₹{maxMrp.toFixed(2)}</span>
                            )}
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="py-4 text-center">
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                          {product.batches?.length || 0}
                        </span>
                      </td>
                      <td className="py-4 text-center space-x-2">
                        <button
                          onClick={() => onEdit?.(product)}
                          className="btn-secondary text-sm px-2 py-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete?.(product.id)}
                          className="btn-danger text-sm px-2 py-1"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>

                    {/* Batch Details Row */}
                    {isExpanded && product.batches && product.batches.length > 0 && (
                      <tr className="bg-gray-50">
                        <td colSpan="8" className="py-4">
                          <div className="ml-8">
                            <h4 className="font-semibold mb-3">Batch Details</h4>
                            <div className="space-y-2">
                              {product.batches.map((batch, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded"
                                >
                                  <div className="flex-1">
                                    <div className="font-semibold">{batch.batch_number}</div>
                                    <div className="text-sm text-gray-600 mt-1">
                                      <span className="inline-block mr-3">MRP: ₹{parseFloat(batch.mrp).toFixed(2)}</span>
                                      <span className="inline-block mr-3">Selling: ₹{parseFloat(batch.selling_rate).toFixed(2)}</span>
                                      <span className="inline-block mr-3">Cost: ₹{parseFloat(batch.cost_price).toFixed(2)}</span>
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                      <span className="inline-block mr-3">Qty: {batch.quantity} {product.unit}</span>
                                      {batch.expiry_date && (
                                        <span className="inline-block">Expiry: {formatDate(batch.expiry_date)}</span>
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
                        <td colSpan="8" className="py-4 text-center text-gray-500">
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
