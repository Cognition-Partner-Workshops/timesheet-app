const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect, admin } = require('../middleware/auth');
const {
  createTestSeries,
  updateTestSeries,
  deleteTestSeries,
  getAdminTestSeries,
} = require('../controllers/testSeriesController');
const {
  createTest,
  getTestById,
  updateTest,
  deleteTest,
} = require('../controllers/testController');
const {
  addQuestion,
  bulkUploadQuestions,
  downloadTemplate,
  updateQuestion,
  deleteQuestion,
} = require('../controllers/questionController');
const { getAdminStats } = require('../controllers/attemptController');

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/json',
  ];
  const allowedExtensions = ['.xlsx', '.xls', '.csv', '.json'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .xlsx, .xls, .csv, and .json files are allowed'), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// All admin routes require authentication + admin role
router.use(protect, admin);

// Dashboard stats
router.get('/stats', getAdminStats);

// Test Series CRUD
router.get('/test-series', getAdminTestSeries);
router.post('/test-series', createTestSeries);
router.put('/test-series/:id', updateTestSeries);
router.delete('/test-series/:id', deleteTestSeries);

// Tests CRUD
router.post('/tests', createTest);
router.get('/tests/:id', getTestById);
router.put('/tests/:id', updateTest);
router.delete('/tests/:id', deleteTest);

// Questions
router.post('/tests/:testId/questions', addQuestion);
router.post('/tests/:testId/questions/bulk-upload', upload.single('file'), bulkUploadQuestions);
router.get('/tests/:testId/questions/template', downloadTemplate);
router.put('/questions/:id', updateQuestion);
router.delete('/questions/:id', deleteQuestion);

module.exports = router;
