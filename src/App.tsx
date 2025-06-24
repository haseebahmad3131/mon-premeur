import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import UsersPage from './pages/UsersPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import AnalyticsToolPage from './pages/AnalyticsToolPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import { AuthProvider, AuthContext } from './contexts/AuthContext';

// Configure future flags for React Router
const routerConfig = {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }
};

interface PrivateRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

function PrivateRoute({ children, requireAdmin = false }: PrivateRouteProps) {
  const auth = React.useContext(AuthContext);
  const location = useLocation();

  if (auth?.isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!auth?.user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (requireAdmin && auth.user.role !== 'Admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter {...routerConfig}>
        <Routes>
          {/* Page d'accueil comme route principale */}
          <Route path="/" element={<HomePage />} />
          
          {/* Route login séparée pour compatibilité */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Route de vérification d'email */}
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          
          {/* Routes protégées */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <PrivateRoute>
                <Layout>
                  <AnalyticsToolPage />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/users"
            element={
              <PrivateRoute requireAdmin>
                <Layout>
                  <UsersPage />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <Layout>
                  <SettingsPage />
                </Layout>
              </PrivateRoute>
            }
          />
          
          {/* Redirection des routes non trouvées vers la page d'accueil */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;