import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import ListingsPage from '@/pages/ListingsPage';
import NegotiationsPage from '@/pages/NegotiationsPage';
import CurrentPOsPage from '@/pages/CurrentPOsPage';
import LoadsPage from '@/pages/LoadsPage';
import ContractsPage from '@/pages/ContractsPage';
import AccountPage from '@/pages/AccountPage';
import AcceptInvitePage from '@/pages/AcceptInvitePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout><DashboardPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/listings"
              element={
                <ProtectedRoute>
                  <AppLayout><ListingsPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/negotiations"
              element={
                <ProtectedRoute>
                  <AppLayout><NegotiationsPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/active-pos"
              element={
                <ProtectedRoute>
                  <AppLayout><CurrentPOsPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/loads"
              element={
                <ProtectedRoute>
                  <AppLayout><LoadsPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contracts"
              element={
                <ProtectedRoute>
                  <AppLayout><ContractsPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <AppLayout><AccountPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
