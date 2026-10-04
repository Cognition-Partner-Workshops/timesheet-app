const express = require('express');
const router = express.Router();
const { getTestForUser } = require('../controllers/testController');
const { startAttempt, submitAttempt, getMyAttempts, getAttemptById } = require('../controllers/attemptController');
const { protect } = require('../middleware/auth');

router.get('/attempts', protect, getMyAttempts);
router.get('/attempts/:id', protect, getAttemptById);
router.get('/:id', protect, getTestForUser);
router.post('/:testId/start', protect, startAttempt);
router.post('/:testId/submit', protect, submitAttempt);

module.exports = router;
