import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/user/Dashboard';
import TestSeriesDetail from './pages/user/TestSeriesDetail';
import TakeTest from './pages/user/TakeTest';
import Results from './pages/user/Results';
import MyAttempts from './pages/user/MyAttempts';
import AdminDashboard from './pages/admin/AdminDashboard';
import CreateTestSeries from './pages/admin/CreateTestSeries';
import ManageTestSeries from './pages/admin/ManageTestSeries';
import ManageQuestions from './pages/admin/ManageQuestions';
import BulkUpload from './pages/admin/BulkUpload';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Test taking has its own layout (no navbar) */}
        <Route
          path="/test/:testId"
          element={
            <ProtectedRoute>
              <TakeTest />
            </ProtectedRoute>
          }
        />

        {/* All other routes with navbar */}
        <Route
          path="*"
          element={
            <>
              <Navbar />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected User Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/test-series/:id"
                  element={
                    <ProtectedRoute>
                      <TestSeriesDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/results/:attemptId"
                  element={
                    <ProtectedRoute>
                      <Results />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-attempts"
                  element={
                    <ProtectedRoute>
                      <MyAttempts />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/test-series/new"
                  element={
                    <ProtectedRoute adminOnly>
                      <CreateTestSeries />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/test-series/:id"
                  element={
                    <ProtectedRoute adminOnly>
                      <ManageTestSeries />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/tests/:testId"
                  element={
                    <ProtectedRoute adminOnly>
                      <ManageQuestions />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/tests/:testId/upload"
                  element={
                    <ProtectedRoute adminOnly>
                      <BulkUpload />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
