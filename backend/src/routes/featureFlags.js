const express = require('express');
const { getFeatureFlags } = require('../config/featureFlags');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(getFeatureFlags());
});

module.exports = router;
