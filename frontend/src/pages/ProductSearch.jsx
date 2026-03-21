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
      console.log('🔍 Searching products with query:', query);

      if (!window?.api?.searchProducts) {
        throw new Error('window.api.searchProducts not available');
      }

      const response = await window.api.searchProducts(query);
      if (response && response.success === false) {
        throw new Error(response.message || 'Failed to search products');
      }

      const data = response.data?.results || response.data || [];
      console.log('✅ Search results:', data);

      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('❌ Search error:', err);
      setError('Failed to search products');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return parseFloat(price || 0).toFixed(2);
  };

  // ✅ REMOVED: formatDate() — no longer needed (expiry column gone)
  // ✅ REMOVED: getExpiryStatus() — no longer needed (expiry column gone)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Product Search Results</h1>
          <p className="text-gray-600 mt-2">
            Search query: <span className="font-semibold text-sky-600">"{query}"</span>
          </p>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block">
            <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600 mt-3">Searching products...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ✅ FIXED: removed "salt/composition" from no-results message */}
      {!loading && results.length === 0 && !error && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-lg">
          <strong>No results.</strong> Try searching with different keywords or check the product name.
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-sky-50 to-blue-50 border-b border-gray-200">
            <p className="text-gray-700">
              Found <span className="font-bold text-lg text-sky-600">{results.length}</span> product{results.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-300">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Product Name</th>
                  {/* ✅ REMOVED: Salt / Composition column */}
                  {/* ✅ REMOVED: Type column */}
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Stock</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Cost Price</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Selling Price</th>
                  {/* ✅ REMOVED: Nearest Expiry column */}
                </tr>
              </thead>
              <tbody>
                {results.map((product, index) => {
                  // ✅ REMOVED: expiryStatus variable
                  const totalStock    = product.total_stock  || 0;
                  const costPrice     = product.cost_price   || 0;
                  const sellingPrice  = product.selling_price || 0;

                  return (
                    <tr
                      key={product.id || index}
                      className="border-b border-gray-200 hover:bg-gray-50 transition"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {product.name}
                      </td>
                      {/* ✅ REMOVED: Salt / Composition <td> */}
                      {/* ✅ REMOVED: Type <td> */}
                      <td className="px-4 py-3 text-center font-semibold">
                        <span className={totalStock <= 10 ? 'text-red-600' : 'text-green-600'}>
                          {totalStock} {product.unit || ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        ₹{formatPrice(costPrice)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        ₹{formatPrice(sellingPrice)}
                      </td>
                      {/* ✅ REMOVED: Nearest Expiry <td> */}
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