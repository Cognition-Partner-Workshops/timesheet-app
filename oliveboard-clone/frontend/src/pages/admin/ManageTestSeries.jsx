import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import API from '../../api/axios';
import Spinner from '../../components/Spinner';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit, FiTrash2, FiEye, FiUpload, FiToggleLeft, FiToggleRight } from 'react-icons/fi';

function ManageTestSeries() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [series, setSeries] = useState(null);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTest, setShowAddTest] = useState(false);
  const [newTest, setNewTest] = useState({
    title: '',
    duration: 60,
    totalMarks: 100,
    negativeMarking: 0.25,
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const { data } = await API.get(`/test-series/${id}`);
      setSeries(data);
      setTests(data.tests || []);
    } catch (error) {
      toast.error('Failed to load test series');
      navigate('/admin');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublish = async () => {
    try {
      await API.put(`/admin/test-series/${id}`, { isPublished: !series.isPublished });
      setSeries({ ...series, isPublished: !series.isPublished });
      toast.success(series.isPublished ? 'Unpublished' : 'Published!');
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleDeleteSeries = async () => {
    if (!window.confirm('Delete this entire test series and all tests/questions? This cannot be undone.')) return;
    try {
      await API.delete(`/admin/test-series/${id}`);
      toast.success('Test series deleted');
      navigate('/admin');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleAddTest = async (e) => {
    e.preventDefault();
    try {
      await API.post('/admin/tests', { ...newTest, testSeriesId: id });
      toast.success('Test created!');
      setShowAddTest(false);
      setNewTest({ title: '', duration: 60, totalMarks: 100, negativeMarking: 0.25 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating test');
    }
  };

  const handleDeleteTest = async (testId) => {
    if (!window.confirm('Delete this test and all its questions?')) return;
    try {
      await API.delete(`/admin/tests/${testId}`);
      toast.success('Test deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete test');
    }
  };

  if (loading) return <Spinner />;
  if (!series) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{series.title}</h1>
              <span className={`text-xs px-2 py-1 rounded-full ${
                series.isPublished ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {series.isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
            <p className="text-gray-500">{series.description}</p>
            <p className="text-sm text-gray-400 mt-1">Category: {series.category}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleTogglePublish}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium ${
                series.isPublished
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {series.isPublished ? <FiToggleRight /> : <FiToggleLeft />}
              {series.isPublished ? 'Unpublish' : 'Publish'}
            </button>
            <button
              onClick={handleDeleteSeries}
              className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium"
            >
              <FiTrash2 /> Delete Series
            </button>
          </div>
        </div>
      </div>

      {/* Tests Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Tests ({tests.length})</h2>
        <button
          onClick={() => setShowAddTest(!showAddTest)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium text-sm"
        >
          <FiPlus /> Add Test
        </button>
      </div>

      {/* Add Test Form */}
      {showAddTest && (
        <form onSubmit={handleAddTest} className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Title</label>
              <input
                type="text"
                value={newTest.title}
                onChange={(e) => setNewTest({ ...newTest, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g., Mock Test 1 - Full Length"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
              <input
                type="number"
                value={newTest.duration}
                onChange={(e) => setNewTest({ ...newTest, duration: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                required
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label>
              <input
                type="number"
                value={newTest.totalMarks}
                onChange={(e) => setNewTest({ ...newTest, totalMarks: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                required
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Negative Marking (per wrong answer)</label>
              <input
                type="number"
                step="0.01"
                value={newTest.negativeMarking}
                onChange={(e) => setNewTest({ ...newTest, negativeMarking: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                min={0}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowAddTest(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              Create Test
            </button>
          </div>
        </form>
      )}

      {/* Tests List */}
      {tests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <p className="text-gray-500">No tests yet. Add your first test to this series.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((test, index) => (
            <div
              key={test._id}
              className="bg-white rounded-xl shadow-sm border p-5 flex items-center justify-between hover:shadow-md transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold">
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{test.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span>{test.duration} min</span>
                    <span>{test.totalMarks} marks</span>
                    <span>{test.questions?.length || 0} questions</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/admin/tests/${test._id}`}
                  className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  <FiEye /> View Questions
                </Link>
                <Link
                  to={`/admin/tests/${test._id}/upload`}
                  className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm"
                >
                  <FiUpload /> Bulk Upload
                </Link>
                <button
                  onClick={() => handleDeleteTest(test._id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ManageTestSeries;
