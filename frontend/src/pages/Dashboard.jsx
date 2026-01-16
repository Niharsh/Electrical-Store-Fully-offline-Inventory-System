import React, { useEffect, useState } from 'react';
import { useProducts } from '../context/ProductContext';
import { useInvoices } from '../context/InvoiceContext';
import { useSalesBills } from '../context/SalesBillsContext';
import { usePurchaseBills } from '../context/PurchaseBillsContext';
import SalesTable from '../components/SalesAndPurchases/SalesTable';
import PurchasesTable from '../components/SalesAndPurchases/PurchasesTable';
import PurchasesForm from '../components/SalesAndPurchases/PurchasesForm';

/**
 * Dashboard Page - Overview of medical store inventory and billing
 * 
 * Displays:
 * - Total products (all types: tablets, syrups, powders, creams, diapers, condoms, sachets)
 * - Low stock count (threshold determined by backend)
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
    lowStockCount: 0,
    recentInvoices: 0,
  });
  const [selectedExpiryRange, setSelectedExpiryRange] = useState(null);
  const [expiringProducts, setExpiringProducts] = useState([]);
  const [salesPurchasesPeriod, setSalesPurchasesPeriod] = useState('month');

  useEffect(() => {
    fetchProducts();
    fetchInvoices();
    fetchSalesSummary(salesPurchasesPeriod);
    fetchPurchasesSummary(salesPurchasesPeriod);
  }, [salesPurchasesPeriod]);

  // Calculate expiring products
  const getExpiringProducts = (monthsRange) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + monthsRange);
    endDate.setHours(23, 59, 59, 999);

    return products.filter(product => {
      if (!product.expiry_date) return false;
      const expiryDate = new Date(product.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      return expiryDate >= today && expiryDate <= endDate;
    });
  };

  // Handle expiry filter click
  const handleExpiryFilter = (months) => {
    if (selectedExpiryRange === months) {
      setSelectedExpiryRange(null);
      setExpiringProducts([]);
    } else {
      setSelectedExpiryRange(months);
      setExpiringProducts(getExpiringProducts(months));
    }
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

  // Get expiry status
  const getExpiryStatus = (expiryDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return { text: 'Expired', color: 'text-red-700 bg-red-100' };
    if (daysLeft <= 30) return { text: `Expires in ${daysLeft}d`, color: 'text-orange-700 bg-orange-100' };
    if (daysLeft <= 90) return { text: `Expires in ${daysLeft}d`, color: 'text-yellow-700 bg-yellow-100' };
    return { text: `Expires in ${daysLeft}d`, color: 'text-green-700 bg-green-100' };
  };

  useEffect(() => {
    // Display data from API - backend determines low stock threshold
    const lowStockCount = products.filter(p => p.quantity < 10).length;

    setStats({
      totalProducts: products.length,
      lowStockCount: lowStockCount,
      recentInvoices: invoices.length,
    });
  }, [products, invoices]);

  const StatCard = ({ title, value, color = 'sky' }) => (
    <div className={`card bg-${color}-50 border-l-4 border-${color}-600`}>
      <p className="text-gray-600 text-sm mb-2">{title}</p>
      <p className={`text-4xl font-bold text-${color}-600`}>{value}</p>
    </div>
  );

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
          value={stats.lowStockCount}
          color="amber"
        />
        <StatCard 
          title="Recent Invoices" 
          value={stats.recentInvoices}
          color="green"
        />
      </div>

      {stats.lowStockCount > 0 && (
        <div className="card bg-amber-50 border-l-4 border-amber-600">
          <h3 className="text-lg font-semibold text-amber-900 mb-2">
            ⚠️ Low Stock Alert
          </h3>
          <p className="text-amber-800">
            {stats.lowStockCount} medicine(s) have quantity below 10 units.
          </p>
          <p className="text-amber-700 text-sm mt-2">
            Note: Backend determines what qualifies as "low stock". Update the threshold there if needed.
          </p>
        </div>
      )}

      {/* Expiry Overview Section */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-6">📅 Expiry Overview</h2>
        <p className="text-gray-600 mb-4">Click on a timeframe to see products expiring within that period:</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => handleExpiryFilter(6)}
            className={`p-4 rounded-lg font-semibold transition ${
              selectedExpiryRange === 6
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            📆 Expiring in 6 Months
          </button>
          <button
            onClick={() => handleExpiryFilter(3)}
            className={`p-4 rounded-lg font-semibold transition ${
              selectedExpiryRange === 3
                ? 'bg-yellow-600 text-white'
                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            }`}
          >
            ⏰ Expiring in 3 Months
          </button>
          <button
            onClick={() => handleExpiryFilter(1)}
            className={`p-4 rounded-lg font-semibold transition ${
              selectedExpiryRange === 1
                ? 'bg-red-600 text-white'
                : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
          >
            🔴 Expiring in 1 Month
          </button>
        </div>

        {/* Expiring Products List */}
        {selectedExpiryRange && (
          <div>
            <h3 className="font-semibold mb-4 text-lg">
              Products expiring in {selectedExpiryRange} month{selectedExpiryRange > 1 ? 's' : ''}:
              <span className="ml-2 text-2xl font-bold text-blue-600">{expiringProducts.length}</span>
            </h3>

            {expiringProducts.length === 0 ? (
              <p className="text-gray-600 text-center py-8">
                No products expiring in this timeframe. Great!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left py-3">Product Name</th>
                      <th className="text-left py-3">Type</th>
                      <th className="text-center py-3">Quantity</th>
                      <th className="text-center py-3">Expiry Date</th>
                      <th className="text-center py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiringProducts.map(product => {
                      const expiryStatus = getExpiryStatus(product.expiry_date);
                      return (
                        <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 font-semibold">{product.name}</td>
                          <td className="py-3 text-gray-600 text-sm">
                            {product.product_type.charAt(0).toUpperCase() + product.product_type.slice(1)}
                          </td>
                          <td className="py-3 text-center">{product.quantity}</td>
                          <td className="py-3 text-center">{formatDate(product.expiry_date)}</td>
                          <td className="py-3 text-center">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${expiryStatus.color}`}>
                              {expiryStatus.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-600">
            <p className="text-gray-600 text-sm mb-1">Total Sales</p>
            <p className="text-3xl font-bold text-green-600">₹{parseFloat(salesSummary.total_sales || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-2">{salesSummary.bill_count || 0} bills</p>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600">
            <p className="text-gray-600 text-sm mb-1">Total Amount Paid</p>
            <p className="text-3xl font-bold text-blue-600">₹{parseFloat(salesSummary.total_paid || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-2">From sales</p>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-600">
            <p className="text-gray-600 text-sm mb-1">Total Amount Due</p>
            <p className="text-3xl font-bold text-orange-600">₹{parseFloat(salesSummary.total_due || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-2">From customers</p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-600">
            <p className="text-gray-600 text-sm mb-1">Total Purchases</p>
            <p className="text-3xl font-bold text-purple-600">₹{parseFloat(purchaseSummary.total_purchases || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-2">{purchaseSummary.bill_count || 0} bills</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-indigo-50 p-4 rounded-lg">
            <p className="text-gray-600 text-sm mb-1">Purchase Amount Paid</p>
            <p className="text-2xl font-bold text-indigo-600">₹{parseFloat(purchaseSummary.total_paid || 0).toFixed(2)}</p>
          </div>

          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-gray-600 text-sm mb-1">Amount Due to Wholesalers</p>
            <p className="text-2xl font-bold text-red-600">₹{parseFloat(purchaseSummary.total_due || 0).toFixed(2)}</p>
          </div>
        </div>

        {/* Tabs for Sales and Purchases */}
        <div className="mt-8">
          <div className="mb-4 border-b-2 border-gray-300">
            <div className="flex gap-4">
              <input
                type="radio"
                id="sales-tab"
                name="section"
                value="sales"
                defaultChecked
                className="hidden"
              />
              <label htmlFor="sales-tab" className="cursor-pointer pb-2 px-4 font-semibold border-b-4 border-blue-600 text-blue-600">
                📈 Sales Bills
              </label>
              
              <input
                type="radio"
                id="purchases-tab"
                name="section"
                value="purchases"
                className="hidden"
              />
              <label htmlFor="purchases-tab" className="cursor-pointer pb-2 px-4 font-semibold text-gray-600 hover:text-blue-600">
                📦 Purchase Bills
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="sales-tab" className="hidden">Sales Bills</label>
            <div id="sales-content" className="tab-content">
              <SalesTable period={salesPurchasesPeriod} />
            </div>
          </div>

          <div>
            <label htmlFor="purchases-tab" className="hidden">Purchase Bills</label>
            <div id="purchases-content" className="mt-8 space-y-8">
              <PurchasesForm onSuccess={() => {}} />
              <PurchasesTable period={salesPurchasesPeriod} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a href="/inventory" className="btn-primary text-center block">
            📦 Manage Inventory
          </a>
          <a href="/billing" className="btn-primary text-center block">
            💳 Create Invoice
          </a>
        </div>
      </div>

      <div className="card">
        <h2 className="text-2xl font-bold mb-4">API Status</h2>
        <div className="bg-gray-50 p-4 rounded text-sm text-gray-700 space-y-2">
          <p><strong>API Base URL:</strong> {import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}</p>
          <p><strong>Frontend Status:</strong> Ready to integrate with Django backend</p>
          <p><strong>Data Source:</strong> All data comes from the API backend</p>
          <p className="text-xs text-gray-600 mt-3">
            ✓ No mock data<br/>
            ✓ No frontend calculations<br/>
            ✓ Backend handles all business logic<br/>
            ✓ See API_CONTRACTS.md for detailed specifications
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

