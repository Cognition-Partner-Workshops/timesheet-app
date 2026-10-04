import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../../api/axios';
import Spinner from '../../components/Spinner';
import { FiCheck, FiX, FiMinus, FiAward, FiClock, FiTarget } from 'react-icons/fi';

function Results() {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSolutions, setShowSolutions] = useState(false);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const { data } = await API.get(`/tests/attempts/${attemptId}`);
        setAttempt(data);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [attemptId]);

  if (loading) return <Spinner />;
  if (!attempt) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Result not found</p>
      </div>
    );
  }

  const percentage = attempt.test?.totalMarks
    ? Math.round((attempt.score / attempt.test.totalMarks) * 100)
    : 0;

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Score Card */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-8 text-white mb-8">
        <h1 className="text-2xl font-bold mb-1">Test Results</h1>
        <p className="text-primary-200 mb-6">{attempt.test?.title}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <FiAward className="text-3xl mx-auto mb-2" />
            <p className="text-3xl font-bold">{attempt.score}/{attempt.test?.totalMarks}</p>
            <p className="text-primary-200 text-sm">Score</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <FiTarget className="text-3xl mx-auto mb-2" />
            <p className="text-3xl font-bold">{percentage}%</p>
            <p className="text-primary-200 text-sm">Percentage</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <FiClock className="text-3xl mx-auto mb-2" />
            <p className="text-3xl font-bold">{formatTime(attempt.totalTimeTaken)}</p>
            <p className="text-primary-200 text-sm">Time Taken</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl mx-auto mb-2">
              {percentage >= 60 ? '🎉' : '📝'}
            </div>
            <p className="text-3xl font-bold">
              {percentage >= 80 ? 'Excellent' : percentage >= 60 ? 'Good' : 'Keep Trying'}
            </p>
            <p className="text-primary-200 text-sm">Performance</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <FiCheck className="text-2xl text-green-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-green-700">{attempt.totalCorrect}</p>
          <p className="text-sm text-green-600">Correct</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <FiX className="text-2xl text-red-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-700">{attempt.totalWrong}</p>
          <p className="text-sm text-red-600">Wrong</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <FiMinus className="text-2xl text-gray-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-gray-700">{attempt.totalUnanswered}</p>
          <p className="text-sm text-gray-500">Unanswered</p>
        </div>
      </div>

      {/* Toggle Solutions */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Question-wise Analysis</h2>
        <button
          onClick={() => setShowSolutions(!showSolutions)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
        >
          {showSolutions ? 'Hide Solutions' : 'View Solutions'}
        </button>
      </div>

      {showSolutions && (
        <div className="space-y-4">
          {attempt.answers.map((ans, index) => {
            const q = ans.question;
            if (!q) return null;

            return (
              <div key={index} className={`bg-white rounded-xl border p-6 ${
                !ans.selectedAnswer
                  ? 'border-gray-200'
                  : ans.isCorrect
                  ? 'border-green-200'
                  : 'border-red-200'
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500">
                    Q{q.questionNumber} | {q.section}
                  </span>
                  {!ans.selectedAnswer ? (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      Unanswered
                    </span>
                  ) : ans.isCorrect ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                      <FiCheck /> Correct
                    </span>
                  ) : (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full flex items-center gap-1">
                      <FiX /> Wrong
                    </span>
                  )}
                </div>

                <p className="font-medium text-gray-900 mb-3">{q.questionText}</p>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  {q.options.map((opt) => (
                    <div
                      key={opt.optionId}
                      className={`p-2 rounded-lg text-sm ${
                        opt.optionId === q.correctAnswer
                          ? 'bg-green-100 text-green-800 font-medium'
                          : opt.optionId === ans.selectedAnswer && !ans.isCorrect
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-50 text-gray-600'
                      }`}
                    >
                      <span className="font-bold mr-2">{opt.optionId}.</span>
                      {opt.text}
                    </div>
                  ))}
                </div>

                {q.explanation && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    <strong>Explanation:</strong> {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="text-center mt-8">
        <Link
          to="/dashboard"
          className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default Results;
