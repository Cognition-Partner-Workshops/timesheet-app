import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../../api/axios';
import Spinner from '../../components/Spinner';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit, FiTrash2, FiUpload, FiSave, FiX } from 'react-icons/fi';

function ManageQuestions() {
  const { testId } = useParams();
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A',
    explanation: '',
    section: 'General',
    marks: 1,
  });

  useEffect(() => {
    fetchTest();
  }, [testId]);

  const fetchTest = async () => {
    try {
      const { data } = await API.get(`/admin/tests/${testId}`);
      setTest(data);
    } catch (error) {
      toast.error('Failed to load test');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      questionText: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: 'A',
      explanation: '',
      section: 'General',
      marks: 1,
    });
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        questionText: formData.questionText,
        options: [
          { optionId: 'A', text: formData.optionA },
          { optionId: 'B', text: formData.optionB },
          { optionId: 'C', text: formData.optionC },
          { optionId: 'D', text: formData.optionD },
        ],
        correctAnswer: formData.correctAnswer,
        explanation: formData.explanation,
        section: formData.section,
        marks: formData.marks,
      };

      if (editingId) {
        await API.put(`/admin/questions/${editingId}`, payload);
        toast.success('Question updated!');
      } else {
        await API.post(`/admin/tests/${testId}/questions`, payload);
        toast.success('Question added!');
      }

      resetForm();
      fetchTest();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error saving question');
    }
  };

  const handleEditQuestion = (question) => {
    setFormData({
      questionText: question.questionText,
      optionA: question.options.find((o) => o.optionId === 'A')?.text || '',
      optionB: question.options.find((o) => o.optionId === 'B')?.text || '',
      optionC: question.options.find((o) => o.optionId === 'C')?.text || '',
      optionD: question.options.find((o) => o.optionId === 'D')?.text || '',
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || '',
      section: question.section || 'General',
      marks: question.marks || 1,
    });
    setEditingId(question._id);
    setShowAddForm(true);
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await API.delete(`/admin/questions/${questionId}`);
      toast.success('Question deleted');
      fetchTest();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  if (loading) return <Spinner />;
  if (!test) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{test.title}</h1>
          <p className="text-gray-500 text-sm">
            {test.questions?.length || 0} questions | {test.duration} min | {test.totalMarks} marks
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/admin/tests/${testId}/upload`}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
          >
            <FiUpload /> Bulk Upload
          </Link>
          <button
            onClick={() => { resetForm(); setShowAddForm(!showAddForm); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
          >
            <FiPlus /> Add Question
          </button>
        </div>
      </div>

      {/* Add/Edit Question Form */}
      {showAddForm && (
        <form onSubmit={handleAddQuestion} className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6 space-y-4">
          <h3 className="font-semibold text-gray-900">
            {editingId ? 'Edit Question' : 'Add New Question'}
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
            <textarea
              value={formData.questionText}
              onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {['A', 'B', 'C', 'D'].map((opt) => (
              <div key={opt}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Option {opt}</label>
                <input
                  type="text"
                  value={formData[`option${opt}`]}
                  onChange={(e) => setFormData({ ...formData, [`option${opt}`]: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
              <select
                value={formData.correctAnswer}
                onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <input
                type="text"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
              <input
                type="number"
                value={formData.marks}
                onChange={(e) => setFormData({ ...formData, marks: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                min={1}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (optional)</label>
            <textarea
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <FiX className="inline mr-1" /> Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              <FiSave className="inline mr-1" /> {editingId ? 'Update' : 'Add'} Question
            </button>
          </div>
        </form>
      )}

      {/* Questions List */}
      {!test.questions || test.questions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <p className="text-gray-500">No questions yet. Add questions individually or use bulk upload.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {test.questions.map((q, index) => (
            <div key={q._id} className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary-600">Q{q.questionNumber || index + 1}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {q.section}
                  </span>
                  <span className="text-xs text-gray-400">{q.marks} mark(s)</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditQuestion(q)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                  >
                    <FiEdit />
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(q._id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>

              <p className="text-gray-900 mb-3">{q.questionText}</p>

              <div className="grid grid-cols-2 gap-2 text-sm">
                {q.options.map((opt) => (
                  <div
                    key={opt.optionId}
                    className={`p-2 rounded-lg ${
                      opt.optionId === q.correctAnswer
                        ? 'bg-green-100 text-green-800 font-medium'
                        : 'bg-gray-50 text-gray-600'
                    }`}
                  >
                    <span className="font-bold mr-2">{opt.optionId}.</span>
                    {opt.text}
                  </div>
                ))}
              </div>

              {q.explanation && (
                <p className="text-sm text-gray-500 mt-2 italic">
                  Explanation: {q.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ManageQuestions;
