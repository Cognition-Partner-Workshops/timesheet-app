import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../../api/axios';
import Spinner from '../../components/Spinner';
import { FiAward, FiClock, FiEye } from 'react-icons/fi';

function MyAttempts() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const { data } = await API.get('/tests/attempts');
        setAttempts(data);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAttempts();
  }, []);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Test Attempts</h1>

      {attempts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <FiAward className="text-5xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500">No attempts yet</h3>
          <p className="text-gray-400 mt-1">Start a test from the dashboard to see your results here</p>
          <Link
            to="/dashboard"
            className="inline-block mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Browse Tests
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => (
            <div
              key={attempt._id}
              className="bg-white rounded-xl shadow-sm border p-5 flex items-center justify-between hover:shadow-md transition"
            >
              <div>
                <h3 className="font-semibold text-gray-900">{attempt.test?.title}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {attempt.test?.testSeries?.title} — {attempt.test?.testSeries?.category}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <FiClock />
                    {formatDate(attempt.createdAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary-600">
                    {attempt.score}/{attempt.test?.totalMarks}
                  </p>
                  <p className="text-xs text-gray-400">
                    {attempt.totalCorrect} correct, {attempt.totalWrong} wrong
                  </p>
                </div>
                <Link
                  to={`/results/${attempt._id}`}
                  className="flex items-center gap-1 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 font-medium text-sm"
                >
                  <FiEye /> View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyAttempts;
