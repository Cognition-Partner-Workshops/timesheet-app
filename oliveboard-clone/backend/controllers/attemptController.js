const Attempt = require('../models/Attempt');
const Test = require('../models/Test');
const Question = require('../models/Question');

// POST /api/tests/:testId/start — start a test attempt
const startAttempt = async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId).populate('questions');
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    // Check if user has an in-progress attempt for this test
    const existingAttempt = await Attempt.findOne({
      user: req.user._id,
      test: req.params.testId,
      status: 'in-progress',
    });

    if (existingAttempt) {
      return res.json(existingAttempt);
    }

    const answers = test.questions.map((q) => ({
      question: q._id,
      selectedAnswer: '',
      isCorrect: false,
      markedForReview: false,
    }));

    const attempt = await Attempt.create({
      user: req.user._id,
      test: req.params.testId,
      answers,
      status: 'in-progress',
    });

    res.status(201).json(attempt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/tests/:testId/submit — submit test answers
const submitAttempt = async (req, res) => {
  try {
    const { attemptId, answers, totalTimeTaken } = req.body;

    const attempt = await Attempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }

    if (attempt.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (attempt.status === 'completed') {
      return res.status(400).json({ message: 'Test already submitted' });
    }

    const test = await Test.findById(req.params.testId).populate('questions');
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    let score = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalUnanswered = 0;

    const processedAnswers = attempt.answers.map((ans) => {
      const userAnswer = answers.find(
        (a) => a.question === ans.question.toString()
      );
      const question = test.questions.find(
        (q) => q._id.toString() === ans.question.toString()
      );

      if (!userAnswer || !userAnswer.selectedAnswer) {
        totalUnanswered++;
        return {
          ...ans.toObject(),
          selectedAnswer: '',
          isCorrect: false,
        };
      }

      const isCorrect = userAnswer.selectedAnswer === question.correctAnswer;

      if (isCorrect) {
        totalCorrect++;
        score += question.marks;
      } else {
        totalWrong++;
        score -= test.negativeMarking || 0;
      }

      return {
        ...ans.toObject(),
        selectedAnswer: userAnswer.selectedAnswer,
        isCorrect,
        markedForReview: userAnswer.markedForReview || false,
      };
    });

    attempt.answers = processedAnswers;
    attempt.score = Math.max(score, 0);
    attempt.totalCorrect = totalCorrect;
    attempt.totalWrong = totalWrong;
    attempt.totalUnanswered = totalUnanswered;
    attempt.totalTimeTaken = totalTimeTaken || 0;
    attempt.status = 'completed';

    await attempt.save();

    res.json(attempt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/attempts — user's attempt history
const getMyAttempts = async (req, res) => {
  try {
    const attempts = await Attempt.find({
      user: req.user._id,
      status: 'completed',
    })
      .populate({
        path: 'test',
        select: 'title duration totalMarks testSeries',
        populate: { path: 'testSeries', select: 'title category' },
      })
      .sort({ createdAt: -1 });

    res.json(attempts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/attempts/:id — detailed attempt result
const getAttemptById = async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.id)
      .populate({
        path: 'test',
        select: 'title duration totalMarks negativeMarking testSeries',
        populate: { path: 'testSeries', select: 'title' },
      })
      .populate({
        path: 'answers.question',
        select: 'questionText options correctAnswer explanation section questionNumber marks',
      });

    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }

    if (attempt.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(attempt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/admin/stats — admin dashboard stats
const getAdminStats = async (req, res) => {
  try {
    const totalAttempts = await Attempt.countDocuments({ status: 'completed' });
    const totalTests = await Test.countDocuments();
    const recentAttempts = await Attempt.find({ status: 'completed' })
      .populate('user', 'name email')
      .populate({ path: 'test', select: 'title' })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      totalAttempts,
      totalTests,
      recentAttempts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  startAttempt,
  submitAttempt,
  getMyAttempts,
  getAttemptById,
  getAdminStats,
};
