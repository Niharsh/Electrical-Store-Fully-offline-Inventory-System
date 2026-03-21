import React, { useEffect, useState } from 'react';
import { useProducts } from '../context/ProductContext';
import { useInvoices } from '../context/InvoiceContext';
import { useSalesBills } from '../context/SalesBillsContext';
import { usePurchaseBills } from '../context/PurchaseBillsContext';
import PurchasesTable from '../components/SalesAndPurchases/PurchasesTable';
import PurchasesForm from '../components/SalesAndPurchases/PurchasesForm';

/**
 * Dashboard Page - Overview of medical store inventory and billing
 * 
 * Displays:
 * - Total products (all types: tablets, syrups, powders, creams, diapers, condoms, sachets)
 * - Low stock items (fetched from backend with product-specific thresholds)
 * - Expiry overview with filtering (6/3/1 month)
 * - Sales & Purchases Overview with paid/due tracking
 * 
 * All data from API - no business logic in frontend
 */
const Dashboard = () => {
  const { products, loading: productsLoading, fetchProducts } = useProducts();
  const { invoices, fetchInvoices } = useInvoices();
  const { summary: salesSummary, fetchSummary: fetchSalesSummary } = useSalesBills();
  const { summary: purchaseSummary, fetchSummary: fetchPurchasesSummary } = usePurchaseBills();
  const [stats, setStats] = useState({
    totalProducts: 0,
    recentInvoices: 0,
  });
  // Low stock state - fetched from API
  const [lowStockItems, setLowStockItems] = useState([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [lowStockLoading, setLowStockLoading] = useState(false);
  const [lowStockError, setLowStockError] = useState('');
  
  const [salesPurchasesPeriod, setSalesPurchasesPeriod] = useState('month');

  // Fetch low stock items from SQLite via IPC
  const fetchLowStockItems = async () => {
    setLowStockLoading(true);
    setLowStockError('');
    try {
      if (!window?.api?.getLowStockItems) {
        throw new Error('window.api.getLowStockItems not available');
      }

      const response = await window.api.getLowStockItems();
      console.log('✅ Low stock items fetched:', response);
      
      if (response && response.success === false) {
        throw new Error(response.message || 'Failed to fetch low stock items');
      }

      setLowStockItems(response.data?.low_stock_items || []);
      setLowStockCount(response.data?.count || 0);
    } catch (error) {
      console.error('❌ Error fetching low stock items:', error);
      setLowStockError('Failed to fetch low stock information');
      setLowStockItems([]);
      setLowStockCount(0);
    } finally {
      setLowStockLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchInvoices();
    fetchLowStockItems();
    fetchSalesSummary(salesPurchasesPeriod);
    fetchPurchasesSummary(salesPurchasesPeriod);
  }, [salesPurchasesPeriod]);

  // Expiry tracking - REMOVED (not applicable to electric shop)

  useEffect(() => {
    // Update stats from fetched data
    setStats({
      totalProducts: products.length,
      recentInvoices: invoices.length,
    });
  }, [products, invoices]);

  const StatCard = ({ title, value, color = 'sky' }) => (
    <div className={`card bg-${color}-50 border-l-4 border-${color}-600`}>
      <p className="text-gray-600 text-sm mb-2">{title}</p>
      <p className={`text-4xl font-bold text-${color}-600`}>{value}</p>
    </div>
  );

  // Get severity color for low stock
  const getSeverityColor = (severity) => {
    if (severity === 'critical') {
      return 'bg-red-100 border-red-300 text-red-900';
    }
    return 'bg-yellow-100 border-yellow-300 text-yellow-900';
  };

  // Get severity badge
  const getSeverityBadge = (severity) => {
    if (severity === 'critical') {
      return <span className="inline-block px-2 py-1 text-xs font-bold bg-red-600 text-white rounded">CRITICAL</span>;
    }
    return <span className="inline-block px-2 py-1 text-xs font-bold bg-yellow-600 text-white rounded">WARNING</span>;
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Products" 
          value={stats.totalProducts}
          color="sky"
        />
        <StatCard 
          title="Low Stock Items" 
          value={lowStockCount}
          color="amber"
        />
        <StatCard 
          title="Recent Invoices" 
          value={stats.recentInvoices}
          color="green"
        />
      </div>

      {/* Low Stock Alert Section */}
      {lowStockCount > 0 && (
        <div className="card">
          <h2 className="text-2xl font-bold mb-4">⚠️ Low Stock Alert</h2>
          <p className="text-gray-600 mb-4">
            {lowStockCount} product{lowStockCount !== 1 ? 's have' : ' has'} fallen below minimum stock level. Please reorder immediately.
          </p>
          
          {lowStockError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">
              {lowStockError}
            </div>
          )}

          {lowStockLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading low stock information...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2">Product Name</th>
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-center px-4 py-2">Current Stock</th>
                    <th className="text-center px-4 py-2">Minimum Required</th>
                    <th className="text-center px-4 py-2">Units Below</th>
                    <th className="text-center px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((item) => (
                    <tr key={item.product_id} className={`border-b ${getSeverityColor(item.severity)}`}>
                      <td className="px-4 py-3 font-semibold">{item.product_name}</td>
                      <td className="px-4 py-3">{item.product_type}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold">{item.current_stock}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold">{item.min_stock_level}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-red-600">-{item.units_below}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getSeverityBadge(item.severity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* No low stock items message */}
      {lowStockCount === 0 && !lowStockLoading && (
        <div className="card bg-green-50 border-l-4 border-green-600">
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            ✅ All Stock Levels Normal
          </h3>
          <p className="text-green-800">
            All Electrical Products are currently above their minimum stock levels. No reordering needed at this time.
          </p>
        </div>
      )}

      {/* Sales & Purchases Overview Section */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">💰 Sales & Purchases Overview</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSalesPurchasesPeriod('month')}
              className={`px-4 py-2 rounded font-semibold transition ${
                salesPurchasesPeriod === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📅 Monthly
            </button>
            <button
              onClick={() => setSalesPurchasesPeriod('year')}
              className={`px-4 py-2 rounded font-semibold transition ${
                salesPurchasesPeriod === 'year'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📊 Annually
            </button>
          </div>
        </div>

        {/* 4-Card Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-green-50 border-l-4 border-green-600 p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-2">Total Sales</p>
                <p className="text-4xl font-bold text-green-600">₹{parseFloat(salesSummary.total_sales || 0).toFixed(2)}</p>
              </div>
              <div className="text-5xl opacity-20">💳</div>
            </div>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-2">Total Purchases</p>
                <p className="text-4xl font-bold text-blue-600">₹{parseFloat(purchaseSummary.total_purchases || 0).toFixed(2)}</p>
              </div>
              <div className="text-5xl opacity-20">📦</div>
            </div>
          </div>

          <div className="bg-emerald-50 border-l-4 border-emerald-600 p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-2">Total Amount Paid</p>
                <p className="text-4xl font-bold text-emerald-600">₹{(parseFloat(salesSummary.total_paid || 0) + parseFloat(purchaseSummary.total_paid || 0)).toFixed(2)}</p>
              </div>
              <div className="text-5xl opacity-20">💰</div>
            </div>
          </div>

          <div className="bg-orange-50 border-l-4 border-orange-600 p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-2">Total Amount Due</p>
                <p className="text-4xl font-bold text-orange-600">₹{(parseFloat(salesSummary.total_due || 0) + parseFloat(purchaseSummary.total_due || 0)).toFixed(2)}</p>
              </div>
              <div className="text-5xl opacity-20">📋</div>
            </div>
          </div>
        </div>

        {/* Purchase Management Section */}
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-4">Purchase Management</h3>
            <PurchasesForm onSuccess={() => {}} />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Purchase Bills</h3>
            <PurchasesTable period={salesPurchasesPeriod} />
          </div>
        </div>
      </div>


    </div>
  );
};

export default Dashboard;

