/**
 * @fileoverview Root React component and application provider tree.
 *
 * Sets up the global providers (React Query, MUI Theme, Auth) and defines
 * the top-level route structure with authentication-guarded routes.
 *
 * @module App
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import WorkEntriesPage from './pages/WorkEntriesPage';
import ReportsPage from './pages/ReportsPage';

/**
 * Application-wide MUI theme.
 * Customizes the primary (blue) and secondary (pink) palette colors.
 */
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

/**
 * TanStack Query client with conservative defaults:
 * - Single retry on failed queries
 * - No automatic refetch on window focus (avoids unexpected data reloads)
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Inner component that reads auth state and renders either the authenticated
 * layout (with sidebar navigation) or redirects to the login page.
 *
 * Separated from {@link App} so that it can call `useAuth` inside the
 * provider boundary.
 */
const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <Layout>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/work-entries" element={<WorkEntriesPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
};

/**
 * Root component that assembles the global provider tree.
 *
 * Provider order (outermost → innermost):
 * 1. **QueryClientProvider** – server-state caching (TanStack Query)
 * 2. **ThemeProvider** + CssBaseline – MUI theming and CSS reset
 * 3. **AuthProvider** – authentication context
 * 4. **AppContent** – routing and page rendering
 */
const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
