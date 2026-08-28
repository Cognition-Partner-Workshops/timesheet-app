const Test = require('../models/Test');
const TestSeries = require('../models/TestSeries');
const Question = require('../models/Question');

// POST /api/admin/tests — create a test in a series
const createTest = async (req, res) => {
  try {
    const { title, testSeriesId, duration, totalMarks, negativeMarking } = req.body;

    const testSeries = await TestSeries.findById(testSeriesId);
    if (!testSeries) {
      return res.status(404).json({ message: 'Test series not found' });
    }

    const test = await Test.create({
      title,
      testSeries: testSeriesId,
      duration,
      totalMarks,
      negativeMarking: negativeMarking || 0,
    });

    testSeries.tests.push(test._id);
    await testSeries.save();

    res.status(201).json(test);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/admin/tests/:id — get test details with questions (admin)
const getTestById = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate('questions');
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }
    res.json(test);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/admin/tests/:id — update test
const updateTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    const { title, duration, totalMarks, negativeMarking, isPublished } = req.body;

    if (title !== undefined) test.title = title;
    if (duration !== undefined) test.duration = duration;
    if (totalMarks !== undefined) test.totalMarks = totalMarks;
    if (negativeMarking !== undefined) test.negativeMarking = negativeMarking;
    if (isPublished !== undefined) test.isPublished = isPublished;

    const updated = await test.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/admin/tests/:id — delete test and its questions
const deleteTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    // Remove test reference from series
    await TestSeries.findByIdAndUpdate(test.testSeries, {
      $pull: { tests: test._id },
    });

    // Delete all questions in this test
    await Question.deleteMany({ test: test._id });
    await Test.findByIdAndDelete(req.params.id);

    res.json({ message: 'Test and all questions deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/tests/:id — get test for taking (user, no correct answers)
const getTestForUser = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
      .populate({
        path: 'questions',
        select: 'questionText options section questionNumber marks',
      });

    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    res.json(test);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createTest,
  getTestById,
  updateTest,
  deleteTest,
  getTestForUser,
};
