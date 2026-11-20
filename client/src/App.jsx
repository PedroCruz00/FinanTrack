import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import Layout from './components/Layout.jsx';
import UpdatePrompt from './components/UpdatePrompt.jsx';
import Brote from './components/Brote.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import TransactionForm from './pages/TransactionForm.jsx';
import Budgets from './pages/Budgets.jsx';

// Pantallas secundarias en archivos aparte: la primera carga es más liviana.
// El service worker las precachea igual, así que también abren sin conexión.
const Reports = lazy(() => import('./pages/Reports.jsx'));
const SyncCenter = lazy(() => import('./pages/SyncCenter.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));

function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

/** Al tocar una notificación con la app abierta, el service worker pide navegar a una ruta. */
function NotificationNavigation() {
  const navigate = useNavigate();
  useEffect(() => {
    const onMessage = (event) => {
      if (event.data?.type === 'navigate' && typeof event.data.url === 'string' && event.data.url.startsWith('/')) {
        navigate(event.data.url);
      }
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, [navigate]);
  return null;
}

const Loading = () => (
  <div className="loading">
    <Brote mood="think" size={88} label="Cargando" />
  </div>
);

const lazyRoute = (Component) => (
  <Suspense fallback={<Loading />}>
    <Component />
  </Suspense>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NotificationNavigation />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="transactions/new" element={<TransactionForm />} />
            <Route path="transactions/:id" element={<TransactionForm />} />
            <Route path="budgets" element={<Budgets />} />
            <Route path="reports" element={lazyRoute(Reports)} />
            <Route path="sync" element={lazyRoute(SyncCenter)} />
            <Route path="settings" element={lazyRoute(Settings)} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <UpdatePrompt />
    </AuthProvider>
  );
}
