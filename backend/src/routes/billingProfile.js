const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { billingProfileSchema } = require('../validation/schemas');
const { getBillingProfile, upsertBillingProfile } = require('../services/invoices');

const router = express.Router();

router.use(authenticateUser);

router.get('/', async (req, res, next) => {
  try {
    res.json({ billingProfile: await getBillingProfile(getDatabase(), req.userEmail) });
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const { error, value } = billingProfileSchema.validate(req.body);
    if (error) return next(error);
    const billingProfile = await upsertBillingProfile(getDatabase(), req.userEmail, value);
    res.json({ message: 'Billing profile saved', billingProfile });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
