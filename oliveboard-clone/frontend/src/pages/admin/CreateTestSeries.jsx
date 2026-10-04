import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import { toast } from 'react-toastify';

const CATEGORIES = ['Banking', 'SSC', 'Railways', 'Insurance', 'Teaching', 'Defence', 'State Exams', 'UPSC', 'Other'];

function CreateTestSeries() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Banking',
    price: 0,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await API.post('/admin/test-series', formData);
      toast.success('Test series created!');
      navigate(`/admin/test-series/${data._id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating test series');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Test Series</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="e.g., SBI PO Prelims 2024 Mock Tests"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="Describe the test series, target exam, and what it covers..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price (0 for Free)</label>
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            min={0}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Test Series'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateTestSeries;
