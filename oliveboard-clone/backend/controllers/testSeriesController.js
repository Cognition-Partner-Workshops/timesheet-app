const TestSeries = require('../models/TestSeries');
const Test = require('../models/Test');
const Question = require('../models/Question');

// GET /api/test-series — list all published series (public)
const getAllTestSeries = async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = { isPublished: true };

    if (category && category !== 'All') {
      filter.category = category;
    }
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }

    const testSeries = await TestSeries.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json(testSeries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/test-series/:id — get single series with tests
const getTestSeriesById = async (req, res) => {
  try {
    const testSeries = await TestSeries.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate({
        path: 'tests',
        select: 'title duration totalMarks negativeMarking questions isPublished',
      });

    if (!testSeries) {
      return res.status(404).json({ message: 'Test series not found' });
    }

    res.json(testSeries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/admin/test-series — create (admin)
const createTestSeries = async (req, res) => {
  try {
    const { title, description, category, image, price } = req.body;

    const testSeries = await TestSeries.create({
      title,
      description,
      category,
      image,
      price,
      createdBy: req.user._id,
    });

    res.status(201).json(testSeries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/admin/test-series/:id — update (admin)
const updateTestSeries = async (req, res) => {
  try {
    const testSeries = await TestSeries.findById(req.params.id);
    if (!testSeries) {
      return res.status(404).json({ message: 'Test series not found' });
    }

    const { title, description, category, image, isPublished, price } = req.body;

    if (title !== undefined) testSeries.title = title;
    if (description !== undefined) testSeries.description = description;
    if (category !== undefined) testSeries.category = category;
    if (image !== undefined) testSeries.image = image;
    if (isPublished !== undefined) testSeries.isPublished = isPublished;
    if (price !== undefined) testSeries.price = price;

    const updated = await testSeries.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/admin/test-series/:id — delete (admin)
const deleteTestSeries = async (req, res) => {
  try {
    const testSeries = await TestSeries.findById(req.params.id);
    if (!testSeries) {
      return res.status(404).json({ message: 'Test series not found' });
    }

    // Delete all questions belonging to tests in this series
    for (const testId of testSeries.tests) {
      await Question.deleteMany({ test: testId });
    }
    // Delete all tests in this series
    await Test.deleteMany({ testSeries: testSeries._id });
    // Delete the series
    await TestSeries.findByIdAndDelete(req.params.id);

    res.json({ message: 'Test series and all associated data deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/admin/test-series — list all series for admin (including unpublished)
const getAdminTestSeries = async (req, res) => {
  try {
    const testSeries = await TestSeries.find()
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json(testSeries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllTestSeries,
  getTestSeriesById,
  createTestSeries,
  updateTestSeries,
  deleteTestSeries,
  getAdminTestSeries,
};
