import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProductProvider } from './context/ProductContext';
import { InvoiceProvider } from './context/InvoiceContext';
import InvoiceDetail from './pages/InvoiceDetail';
import { SalesBillsProvider } from './context/SalesBillsContext';
import { PurchaseBillsProvider } from './context/PurchaseBillsContext';
import { WholesalersProvider } from './context/WholesalersContext';
import Header from './components/Common/Header';
import Navigation from './components/Common/Navigation';
import ProtectedRoute from './components/Common/ProtectedRoute';
import BillingForm from './components/Billing/BillingForm';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Billing from './pages/Billing';
import Settings from './pages/Settings';
import ProductSearch from './pages/ProductSearch';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ActivationPage from './pages/ActivationPage';
import './App.css';
import ErrorBoundary from './components/Common/ErrorBoundary';

// ─────────────────────────────────────────────
// Loading spinner (shown while auth initializes)
// ─────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main authenticated layout with providers
// ─────────────────────────────────────────────
function AuthenticatedLayout() {
  return (
    <ProductProvider>
      <InvoiceProvider>
        <SalesBillsProvider>
          <PurchaseBillsProvider>
            <WholesalersProvider>
              <div className="min-h-screen bg-gray-50">
                <div className="print-hidden">
                  <Header />
                  <Navigation />
                </div>
                <Routes>
                  <Route path="/activate" element={<ActivationPage />} />

                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <main className="w-full px-6 py-8 lg:px-8">
                          <Dashboard />
                        </main>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/inventory"
                    element={
                      <ProtectedRoute>
                        <main className="w-full px-6 py-8 lg:px-8">
                          <Inventory />
                        </main>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/billing"
                    element={
                      <ProtectedRoute>
                        <main className="w-full px-6 py-8 lg:px-8">
                          <Billing />
                        </main>
                      </ProtectedRoute>
                    }
                  />

                  
                  <Route
                    path="/billing/invoices/:id"
                    element={
                      <ProtectedRoute>
                        <main className="w-full px-6 py-8 lg:px-8">
                          <InvoiceDetail />
                        </main>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* ── Edit Invoice ── NEW */}
                  <Route
                    path="/billing/invoices/:id/edit"
                    element={
                      <ProtectedRoute>
                        <main className="w-full px-6 py-8 lg:px-8">
                          <BillingForm />
                        </main>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <main className="w-full px-6 py-8 lg:px-8">
                          <Settings />
                        </main>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/search"
                    element={
                      <ProtectedRoute>
                        <main className="w-full px-6 py-8 lg:px-8">
                          <ProductSearch />
                        </main>
                      </ProtectedRoute>
                    }
                  />

                  {/* Catch-all → dashboard */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </div>
            </WholesalersProvider>
          </PurchaseBillsProvider>
        </SalesBillsProvider>
      </InvoiceProvider>
    </ProductProvider>
  );
}

// ─────────────────────────────────────────────
// AppContent — ONE Router, conditional rendering
// inside Routes, not multiple Routers
// ─────────────────────────────────────────────
function AppContent() {
  const { auth, ownerExists, loading } = useAuth();

  // ✅ Activation window check (hash-based)
  const isActivationWindow =
    window.location.hash === '#activate' ||
    window.location.hash === '#/activate';

  if (isActivationWindow) {
    return (
      <Routes>
        <Route path="/activate" element={<ActivationPage />} />
        <Route path="*" element={<Navigate to="/activate" replace />} />
      </Routes>
    );
  }

  // ✅ Auth still initializing
  if (loading) {
    return <LoadingScreen />;
  }

  // ✅ No owner yet → force signup
  if (ownerExists === false) {
    return (
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Navigate to="/signup" replace />} />
      </Routes>
    );
  }

  // ✅ Owner exists but not logged in
  // → /login and /forgot-password available, everything else → /login
  if (!auth) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // ✅ Authenticated → full app
  return <AuthenticatedLayout />;
}

// ─────────────────────────────────────────────
// Root — Router wraps EVERYTHING, only created once
// ─────────────────────────────────────────────
function App() {
  return (
    // ✅ Single Router instance — never remounts
    <Router>
      <AuthProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  );
}

export default App;