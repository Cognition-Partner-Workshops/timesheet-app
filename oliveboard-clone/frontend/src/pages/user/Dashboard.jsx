import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../../api/axios';
import Spinner from '../../components/Spinner';
import { FiSearch, FiBook, FiClock, FiAward } from 'react-icons/fi';

const CATEGORIES = ['All', 'Banking', 'SSC', 'Railways', 'Insurance', 'Teaching', 'Defence', 'State Exams', 'UPSC', 'Other'];

function Dashboard() {
  const [testSeries, setTestSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchTestSeries();
  }, [selectedCategory, search]);

  const fetchTestSeries = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (search) params.search = search;
      const { data } = await API.get('/test-series', { params });
      setTestSeries(data);
    } catch (error) {
      console.error('Error fetching test series:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-8 mb-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Explore Test Series</h1>
        <p className="text-primary-100 mb-6">
          Practice with thousands of questions across various competitive exams
        </p>
        <div className="relative max-w-xl">
          <FiSearch className="absolute left-4 top-3.5 text-gray-400 text-lg" />
          <input
            type="text"
            placeholder="Search test series..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl text-gray-900 focus:ring-2 focus:ring-primary-300 outline-none"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              selectedCategory === cat
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Test Series Grid */}
      {loading ? (
        <Spinner />
      ) : testSeries.length === 0 ? (
        <div className="text-center py-16">
          <FiBook className="text-5xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500">No test series found</h3>
          <p className="text-gray-400 mt-1">Try a different category or search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testSeries.map((series) => (
            <Link
              to={`/test-series/${series._id}`}
              key={series._id}
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition border border-gray-100 overflow-hidden group"
            >
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 h-32 flex items-center justify-center">
                <FiBookOpen className="text-5xl text-white opacity-50" />
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded-full">
                    {series.category}
                  </span>
                  {series.price === 0 && (
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      Free
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 text-lg group-hover:text-primary-600 transition">
                  {series.title}
                </h3>
                <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                  {series.description}
                </p>
                <div className="flex items-center gap-4 mt-4 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <FiBook />
                    <span>{series.tests?.length || 0} Tests</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FiAward />
                    <span>By {series.createdBy?.name || 'Admin'}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FiBookOpen(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
    </svg>
  );
}

export default Dashboard;
