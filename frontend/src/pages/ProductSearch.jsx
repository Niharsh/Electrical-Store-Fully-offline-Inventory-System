// src/pages/ProductSearch.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const ProductSearch = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query && query.trim().length >= 1) {
      searchProducts();
    }
  }, [query]);

  const searchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      if (!window?.api?.searchProducts) {
        throw new Error('window.api.searchProducts not available');
      }

      const response = await window.api.searchProducts(query);

      if (response && response.success === false) {
        throw new Error(response.message || 'Failed to search products');
      }

      // ✅ handles both: plain array OR { data: { results: [] } }
      const data =
        Array.isArray(response)              ? response :
        Array.isArray(response?.data)        ? response.data :
        Array.isArray(response?.data?.results) ? response.data.results :
        [];

      setResults(data);
    } catch (err) {
      console.error('❌ Search error:', err);
      setError('Failed to search products');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) =>
    parseFloat(price || 0).toFixed(2);

  return (
    <div className="space-y-6">

      {/* ── Title ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Product Search Results
        </h1>
        <p className="text-gray-600 mt-2">
          Search query:{' '}
          <span className="font-semibold text-sky-600">"{query}"</span>
        </p>
      </div>

      {/* ── Loading ───────────────────────────────────────────── */}
      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent
                          rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Searching products...</p>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700
                        p-4 rounded-lg">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ── No results ────────────────────────────────────────── */}
      {!loading && !error && results.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700
                        p-4 rounded-lg">
          <strong>No results.</strong> Try searching with different keywords.
        </div>
      )}

      {/* ── Results table ─────────────────────────────────────── */}
      {!loading && results.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">

          {/* Count bar */}
          <div className="p-4 bg-gradient-to-r from-sky-50 to-blue-50
                          border-b border-gray-200">
            <p className="text-gray-700">
              Found{' '}
              <span className="font-bold text-lg text-sky-600">
                {results.length}
              </span>{' '}
              product{results.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b border-gray-300">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">
                    Product Name
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">
                    Stock
                  </th>
                  {/* ✅ Unit (was Cost Price) */}
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">
                    Unit
                  </th>
                  {/* ✅ MRP (was Selling Price) */}
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">
                    MRP
                  </th>
                </tr>
              </thead>

              <tbody>
                {results.map((product, index) => {
                  const totalStock = parseFloat(product.total_stock || 0);
                  const mrp        = parseFloat(product.mrp || product.max_mrp || 0);

                  return (
                    <tr
                      key={product.id || index}
                      className="border-b border-gray-200 hover:bg-gray-50 transition"
                    >
                      {/* Name */}
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {product.name}
                      </td>

                      {/* Stock — red if ≤ 10, green otherwise */}
                      <td className="px-4 py-3 text-center font-semibold">
                        <span className={
                          totalStock <= 10 ? 'text-red-600' : 'text-green-600'
                        }>
                          {totalStock}
                        </span>
                      </td>

                      {/* ✅ Unit */}
                      <td className="px-4 py-3 text-center text-gray-700">
                        {product.unit || '—'}
                      </td>

                      {/* ✅ MRP */}
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        ₹{formatPrice(mrp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductSearch;