import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import Spinner from '../../components/Spinner';
import { toast } from 'react-toastify';
import { FiClock, FiFlag, FiChevronLeft, FiChevronRight, FiSend } from 'react-icons/fi';

function TakeTest() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  useEffect(() => {
    const initTest = async () => {
      try {
        const [testRes, attemptRes] = await Promise.all([
          API.get(`/tests/${testId}`),
          API.post(`/tests/${testId}/start`),
        ]);
        setTest(testRes.data);
        setAttempt(attemptRes.data);
        setTimeLeft(testRes.data.duration * 60);
      } catch (error) {
        toast.error('Failed to load test');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    initTest();
  }, [testId, navigate]);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0 || !test) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, test]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSelectAnswer = (questionId, option) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleToggleReview = (questionId) => {
    setMarkedForReview((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const handleClearAnswer = (questionId) => {
    setAnswers((prev) => {
      const newAnswers = { ...prev };
      delete newAnswers[questionId];
      return newAnswers;
    });
  };

  const handleSubmit = useCallback(
    async (autoSubmit = false) => {
      if (!attempt || !test) return;

      try {
        const formattedAnswers = test.questions.map((q) => ({
          question: q._id,
          selectedAnswer: answers[q._id] || '',
          markedForReview: markedForReview[q._id] || false,
        }));

        const totalTimeTaken = test.duration * 60 - timeLeft;

        const { data } = await API.post(`/tests/${testId}/submit`, {
          attemptId: attempt._id,
          answers: formattedAnswers,
          totalTimeTaken,
        });

        toast.success(autoSubmit ? 'Time up! Test auto-submitted.' : 'Test submitted successfully!');
        navigate(`/results/${data._id}`);
      } catch (error) {
        toast.error('Failed to submit test');
      }
    },
    [attempt, test, answers, markedForReview, timeLeft, testId, navigate]
  );

  if (loading) return <Spinner />;
  if (!test || !test.questions || test.questions.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">No questions found in this test</p>
      </div>
    );
  }

  const question = test.questions[currentQuestion];
  const totalAnswered = Object.keys(answers).length;
  const totalMarked = Object.values(markedForReview).filter(Boolean).length;
  const totalUnanswered = test.questions.length - totalAnswered;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Timer Bar */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">{test.title}</h2>
          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2 font-mono text-lg font-bold ${
              timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-gray-700'
            }`}>
              <FiClock />
              {formatTime(timeLeft)}
            </div>
            <button
              onClick={() => setShowConfirmSubmit(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
            >
              <FiSend />
              Submit Test
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Main Question Area */}
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
                {question.section || 'General'}
              </span>
              <span className="text-sm text-gray-500">
                Marks: {question.marks || 1}
              </span>
            </div>

            <h3 className="text-lg font-medium text-gray-900 mb-6">
              <span className="text-primary-600 font-bold mr-2">Q{currentQuestion + 1}.</span>
              {question.questionText}
            </h3>

            <div className="space-y-3">
              {question.options.map((opt) => (
                <button
                  key={opt.optionId}
                  onClick={() => handleSelectAnswer(question._id, opt.optionId)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition ${
                    answers[question._id] === opt.optionId
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full mr-3 text-sm font-bold ${
                    answers[question._id] === opt.optionId
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {opt.optionId}
                  </span>
                  {opt.text}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="flex gap-3">
                <button
                  onClick={() => handleClearAnswer(question._id)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border rounded-lg"
                >
                  Clear Response
                </button>
                <button
                  onClick={() => handleToggleReview(question._id)}
                  className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border ${
                    markedForReview[question._id]
                      ? 'text-orange-600 border-orange-300 bg-orange-50'
                      : 'text-gray-500 hover:text-orange-600'
                  }`}
                >
                  <FiFlag />
                  {markedForReview[question._id] ? 'Marked for Review' : 'Mark for Review'}
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
                  disabled={currentQuestion === 0}
                  className="flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  <FiChevronLeft /> Previous
                </button>
                <button
                  onClick={() => setCurrentQuestion((prev) => Math.min(test.questions.length - 1, prev + 1))}
                  disabled={currentQuestion === test.questions.length - 1}
                  className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  Next <FiChevronRight />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Question Navigation Panel */}
        <div className="w-72 shrink-0">
          <div className="bg-white rounded-xl shadow-sm border p-4 sticky top-20">
            <h4 className="font-semibold text-gray-700 mb-3">Question Palette</h4>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {test.questions.map((q, i) => (
                <button
                  key={q._id}
                  onClick={() => setCurrentQuestion(i)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition ${
                    i === currentQuestion
                      ? 'bg-primary-600 text-white ring-2 ring-primary-300'
                      : markedForReview[q._id]
                      ? 'bg-orange-100 text-orange-700 border border-orange-300'
                      : answers[q._id]
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="space-y-2 text-xs text-gray-500 border-t pt-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                <span>Answered ({totalAnswered})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
                <span>Not Answered ({totalUnanswered})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
                <span>Marked for Review ({totalMarked})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Submit Test?</h3>
            <div className="space-y-2 text-sm text-gray-600 mb-6">
              <p>Total Questions: {test.questions.length}</p>
              <p className="text-green-600">Answered: {totalAnswered}</p>
              <p className="text-red-600">Unanswered: {totalUnanswered}</p>
              <p className="text-orange-600">Marked for Review: {totalMarked}</p>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to submit? You won't be able to change your answers.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Go Back
              </button>
              <button
                onClick={() => {
                  setShowConfirmSubmit(false);
                  handleSubmit();
                }}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                Submit Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TakeTest;
