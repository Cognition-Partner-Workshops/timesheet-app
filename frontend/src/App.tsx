import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme/theme';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Interviews from './pages/Interviews';
import Questions from './pages/Questions';
import Candidates from './pages/Candidates';
import Panels from './pages/Panels';
import CodeEditor from './pages/CodeEditor';
import Reports from './pages/Reports';
import VideoCall from './pages/VideoCall';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="interviews" element={<Interviews />} />
            <Route path="questions" element={<Questions />} />
            <Route path="candidates" element={<Candidates />} />
            <Route path="panels" element={<Panels />} />
            <Route path="code-editor" element={<CodeEditor />} />
            <Route path="reports" element={<Reports />} />
            <Route path="video-call" element={<VideoCall />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;
