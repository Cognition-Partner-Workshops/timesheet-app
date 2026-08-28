const express = require('express');
const router = express.Router();
const {
  getAllTestSeries,
  getTestSeriesById,
} = require('../controllers/testSeriesController');

router.get('/', getAllTestSeries);
router.get('/:id', getTestSeriesById);

module.exports = router;
