import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ProductProvider } from './context/ProductContext';
import { InvoiceProvider } from './context/InvoiceContext';
import { SalesBillsProvider } from './context/SalesBillsContext';
import { PurchaseBillsProvider } from './context/PurchaseBillsContext';
import { WholesalersProvider } from './context/WholesalersContext';
import Header from './components/Common/Header';
import Navigation from './components/Common/Navigation';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Billing from './pages/Billing';
import Settings from './pages/Settings';
import './App.css';

function App() {
  return (
    <Router>
      <ProductProvider>
        <InvoiceProvider>
          <SalesBillsProvider>
            <PurchaseBillsProvider>
              <WholesalersProvider>
                <div className="min-h-screen bg-gray-50">
                  <Header />
                  <Navigation />
                  <main className="max-w-7xl mx-auto px-4 py-8">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/inventory" element={<Inventory />} />
                      <Route path="/billing" element={<Billing />} />
                      <Route path="/settings" element={<Settings />} />
                    </Routes>
                  </main>
                </div>
              </WholesalersProvider>
            </PurchaseBillsProvider>
          </SalesBillsProvider>
        </InvoiceProvider>
      </ProductProvider>
    </Router>
  );
}

export default App;
