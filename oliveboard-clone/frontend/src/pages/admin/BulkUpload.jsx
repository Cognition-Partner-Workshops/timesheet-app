import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import { toast } from 'react-toastify';
import { FiUploadCloud, FiDownload, FiFile, FiCheckCircle, FiAlertTriangle, FiX } from 'react-icons/fi';

function BulkUpload() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  const handleDownloadTemplate = async () => {
    try {
      const response = await API.get(`/admin/tests/${testId}/questions/template`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'question_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded!');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleFileSelect = (selectedFile) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv', '.json'];
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      toast.error('Invalid file type. Use .xlsx, .csv, or .json');
      return;
    }
    setFile(selectedFile);
    setPreview(null);
    setErrors([]);
  };

  const handlePreview = async () => {
    if (!file) return;
    setUploading(true);
    setErrors([]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await API.post(
        `/admin/tests/${testId}/questions/bulk-upload?preview=true`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setPreview(data);
      toast.success(`Preview: ${data.totalQuestions} questions found`);
    } catch (error) {
      const errData = error.response?.data;
      if (errData?.errors) {
        setErrors(errData.errors);
        toast.error(`${errData.errors.length} validation error(s) found`);
      } else {
        toast.error(errData?.message || 'Error parsing file');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await API.post(
        `/admin/tests/${testId}/questions/bulk-upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      toast.success(data.message);
      navigate(`/admin/tests/${testId}`);
    } catch (error) {
      const errData = error.response?.data;
      if (errData?.errors) {
        setErrors(errData.errors);
        toast.error('Upload failed due to validation errors');
      } else {
        toast.error(errData?.message || 'Upload failed');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Bulk Upload Questions</h1>
      <p className="text-gray-500 mb-8">
        Upload questions via Excel, CSV, or JSON file. Download the template first for the correct format.
      </p>

      {/* Step 1: Download Template */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm">1</span>
          Download Template
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Download the Excel template with sample data. Fill in your questions following the same format.
        </p>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
        >
          <FiDownload /> Download Excel Template
        </button>

        <div className="mt-4 bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <p className="font-medium mb-2">Template columns:</p>
          <p className="font-mono text-xs">
            QuestionNumber | Section | QuestionText | OptionA | OptionB | OptionC | OptionD | CorrectAnswer | Explanation | Marks
          </p>
        </div>
      </div>

      {/* Step 2: Upload File */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm">2</span>
          Upload Your File
        </h2>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
            dragOver
              ? 'border-primary-400 bg-primary-50'
              : file
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FiFile className="text-2xl text-green-600" />
              <div>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={() => { setFile(null); setPreview(null); setErrors([]); }}
                className="ml-4 p-1 text-red-500 hover:bg-red-50 rounded-lg"
              >
                <FiX />
              </button>
            </div>
          ) : (
            <>
              <FiUploadCloud className="text-4xl text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-1">Drag & drop your file here, or</p>
              <label className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium cursor-pointer">
                Browse Files
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.json"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-400 mt-2">Supports .xlsx, .xls, .csv, .json (max 5MB)</p>
            </>
          )}
        </div>

        {file && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={handlePreview}
              disabled={uploading}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {uploading ? 'Processing...' : 'Preview & Validate'}
            </button>
            {preview && errors.length === 0 && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : `Upload ${preview.totalQuestions} Questions`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-red-800 flex items-center gap-2 mb-3">
            <FiAlertTriangle /> Validation Errors ({errors.length})
          </h3>
          <ul className="space-y-1 text-sm text-red-700 max-h-60 overflow-y-auto">
            {errors.map((err, i) => (
              <li key={i} className="flex items-start gap-2">
                <FiX className="mt-0.5 shrink-0" />
                {err}
              </li>
            ))}
          </ul>
          <p className="text-sm text-red-600 mt-3">
            Fix these errors in your file and upload again.
          </p>
        </div>
      )}

      {/* Preview */}
      {preview && preview.questions && errors.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-green-800 flex items-center gap-2 mb-3">
            <FiCheckCircle /> Preview — {preview.totalQuestions} Questions Ready
          </h3>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-green-100">
                <tr>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Section</th>
                  <th className="text-left px-3 py-2">Question</th>
                  <th className="text-left px-3 py-2">Answer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-green-100">
                {preview.questions.slice(0, 20).map((q, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-gray-600">{q.questionNumber}</td>
                    <td className="px-3 py-2 text-gray-600">{q.section}</td>
                    <td className="px-3 py-2 text-gray-900">{q.questionText.substring(0, 80)}...</td>
                    <td className="px-3 py-2 font-medium text-green-700">{q.correctAnswer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.totalQuestions > 20 && (
              <p className="text-sm text-gray-500 mt-2 px-3">
                ...and {preview.totalQuestions - 20} more questions
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BulkUpload;
