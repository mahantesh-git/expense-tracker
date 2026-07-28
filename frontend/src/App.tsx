import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ClientDashboard from './pages/ClientDashboard';
import AdminUserDetail from './pages/AdminUserDetail';
import IPaidPage from './pages/IPaidPage';
import IWasChargedPage from './pages/IWasChargedPage';
import BalancesPage from './pages/BalancesPage';
import ClientRequestsPage from './pages/ClientRequestsPage';
import { InstallPrompt } from './components/InstallPrompt';

const PrivateRoute = ({ children, role }: { children: React.ReactNode, role?: 'admin' | 'client' }) => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/client'} replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to={user.role === 'admin' ? '/admin' : '/client'} />} />
      
      <Route path="/admin" element={
        <PrivateRoute role="admin">
          <AdminDashboard />
        </PrivateRoute>
      } />
      
      <Route path="/admin/user/:id" element={
        <PrivateRoute role="admin">
          <AdminUserDetail />
        </PrivateRoute>
      } />
      
      <Route path="/client" element={
        <PrivateRoute role="client">
          <ClientDashboard />
        </PrivateRoute>
      } />

      <Route path="/client/paid" element={
        <PrivateRoute role="client">
          <IPaidPage />
        </PrivateRoute>
      } />

      <Route path="/client/charged" element={
        <PrivateRoute role="client">
          <IWasChargedPage />
        </PrivateRoute>
      } />

      <Route path="/client/balances" element={
        <PrivateRoute role="client">
          <BalancesPage />
        </PrivateRoute>
      } />

      <Route path="/client/requests" element={
        <PrivateRoute role="client">
          <ClientRequestsPage />
        </PrivateRoute>
      } />

      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <Router>
          <AppRoutes />
        </Router>
        <InstallPrompt />
      </div>
    </AuthProvider>
  );
};

export default App;
