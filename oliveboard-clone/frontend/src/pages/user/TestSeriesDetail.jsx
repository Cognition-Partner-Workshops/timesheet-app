import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import Spinner from '../../components/Spinner';
import { FiClock, FiFileText, FiAlertCircle, FiPlay } from 'react-icons/fi';

function TestSeriesDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSeries = async () => {
      try {
        const { data } = await API.get(`/test-series/${id}`);
        setSeries(data);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSeries();
  }, [id]);

  const handleStartTest = (testId) => {
    navigate(`/test/${testId}`);
  };

  if (loading) return <Spinner />;
  if (!series) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl text-gray-500">Test series not found</h2>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-8 text-white mb-8">
        <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">
          {series.category}
        </span>
        <h1 className="text-3xl font-bold mt-4">{series.title}</h1>
        <p className="text-primary-100 mt-2 max-w-2xl">{series.description}</p>
        <div className="flex items-center gap-6 mt-6 text-sm">
          <div className="flex items-center gap-2">
            <FiFileText />
            <span>{series.tests?.length || 0} Tests</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Created by {series.createdBy?.name || 'Admin'}</span>
          </div>
        </div>
      </div>

      {/* Tests List */}
      <h2 className="text-xl font-bold text-gray-900 mb-4">Available Tests</h2>
      {series.tests && series.tests.length > 0 ? (
        <div className="space-y-4">
          {series.tests.map((test, index) => (
            <div
              key={test._id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between hover:shadow-md transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold">
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{test.title}</h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <FiClock className="text-xs" />
                      {test.duration} min
                    </span>
                    <span className="flex items-center gap-1">
                      <FiFileText className="text-xs" />
                      {test.questions?.length || 0} Questions
                    </span>
                    <span>Total Marks: {test.totalMarks}</span>
                    {test.negativeMarking > 0 && (
                      <span className="flex items-center gap-1 text-red-500">
                        <FiAlertCircle className="text-xs" />
                        -{test.negativeMarking} negative
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleStartTest(test._id)}
                className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-lg hover:bg-primary-700 font-medium transition"
              >
                <FiPlay />
                Start Test
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-500">No tests available yet in this series</p>
        </div>
      )}
    </div>
  );
}

export default TestSeriesDetail;
