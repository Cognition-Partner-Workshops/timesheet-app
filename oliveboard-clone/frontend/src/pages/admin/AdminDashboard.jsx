import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../../api/axios';
import Spinner from '../../components/Spinner';
import { FiBook, FiUsers, FiFileText, FiPlus, FiBarChart } from 'react-icons/fi';

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [testSeries, setTestSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, seriesRes] = await Promise.all([
          API.get('/admin/stats'),
          API.get('/admin/test-series'),
        ]);
        setStats(statsRes.data);
        setTestSeries(seriesRes.data);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <Link
          to="/admin/test-series/new"
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg hover:bg-primary-700 font-medium"
        >
          <FiPlus /> New Test Series
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <FiBook className="text-xl text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{testSeries.length}</p>
              <p className="text-sm text-gray-500">Test Series</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <FiFileText className="text-xl text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalTests || 0}</p>
              <p className="text-sm text-gray-500">Total Tests</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <FiBarChart className="text-xl text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalAttempts || 0}</p>
              <p className="text-sm text-gray-500">Total Attempts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Test Series Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">All Test Series</h2>
        </div>
        {testSeries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No test series yet. Create your first one!
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Tests</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {testSeries.map((series) => (
                <tr key={series._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{series.title}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-full">
                      {series.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{series.tests?.length || 0}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      series.isPublished
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {series.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/admin/test-series/${series._id}`}
                      className="text-primary-600 hover:underline text-sm font-medium"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Attempts */}
      {stats?.recentAttempts && stats.recentAttempts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden mt-8">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold text-gray-900">Recent Attempts</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.recentAttempts.map((attempt) => (
              <div key={attempt._id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-700">{attempt.user?.name}</span>
                  <span className="text-gray-400 mx-2">-</span>
                  <span className="text-gray-500">{attempt.test?.title}</span>
                </div>
                <span className="font-medium text-primary-600">{attempt.score} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
