const express = require('express');
const Joi = require('joi');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const {
  isoDateOnly,
  invoiceSchema,
  updateInvoiceSchema,
  markPaidSchema,
  voidInvoiceSchema,
} = require('../validation/schemas');
const invoices = require('../services/invoices');
const { streamInvoicePdf } = require('../services/invoicePdf');

const router = express.Router();

router.use(authenticateUser);

const listQuerySchema = Joi.object({
  status: Joi.string().valid('draft', 'issued', 'paid', 'void', 'overdue').optional(),
  clientId: Joi.number().integer().positive().optional(),
  from: isoDateOnly().optional(),
  to: isoDateOnly().optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

const previewQuerySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  from: isoDateOnly().optional(),
  to: isoDateOnly().optional(),
});

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

function invoiceId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new invoices.HttpError(400, 'Invalid invoice ID');
  }
  return id;
}

function validate(schema, payload) {
  const { error, value } = schema.validate(payload);
  if (error) throw error;
  return value;
}

router.get('/', handle(async (req, res) => {
  const filters = validate(listQuerySchema, req.query);
  res.json(await invoices.listInvoices(getDatabase(), req.userEmail, filters));
}));

router.get('/preview', handle(async (req, res) => {
  const query = validate(previewQuerySchema, req.query);
  res.json(await invoices.previewUnbilled(getDatabase(), req.userEmail, query));
}));

router.get('/:id', handle(async (req, res) => {
  res.json({ invoice: await invoices.getInvoice(getDatabase(), req.userEmail, invoiceId(req)) });
}));

router.get('/:id/pdf', handle(async (req, res) => {
  const invoice = await invoices.getInvoice(getDatabase(), req.userEmail, invoiceId(req));
  streamInvoicePdf(invoice, req.userEmail, res);
}));

router.post('/', handle(async (req, res) => {
  const value = validate(invoiceSchema, req.body);
  const db = getDatabase();
  const id = await invoices.createInvoice(db, req.userEmail, value);
  res.status(201).json({ message: 'Draft invoice created', invoice: await invoices.getInvoice(db, req.userEmail, id) });
}));

router.put('/:id', handle(async (req, res) => {
  const id = invoiceId(req);
  const value = validate(updateInvoiceSchema, req.body);
  const db = getDatabase();
  await invoices.updateInvoice(db, req.userEmail, id, value);
  res.json({ message: 'Invoice updated', invoice: await invoices.getInvoice(db, req.userEmail, id) });
}));

router.delete('/:id', handle(async (req, res) => {
  await invoices.deleteInvoice(getDatabase(), req.userEmail, invoiceId(req));
  res.json({ message: 'Draft invoice deleted' });
}));

const actions = {
  issue: { run: (db, email, id) => invoices.issueInvoice(db, email, id), message: 'Invoice issued' },
  'mark-paid': {
    run: (db, email, id, body) => invoices.markPaid(db, email, id, validate(markPaidSchema, body).paidDate),
    message: 'Invoice marked as paid',
  },
  'mark-unpaid': { run: (db, email, id) => invoices.markUnpaid(db, email, id), message: 'Invoice marked as unpaid' },
  void: {
    run: (db, email, id, body) => invoices.voidInvoice(db, email, id, validate(voidInvoiceSchema, body).reason),
    message: 'Invoice voided',
  },
};

Object.entries(actions).forEach(([path, action]) => {
  router.post(`/:id/${path}`, handle(async (req, res) => {
    const id = invoiceId(req);
    const db = getDatabase();
    await action.run(db, req.userEmail, id, req.body || {});
    res.json({ message: action.message, invoice: await invoices.getInvoice(db, req.userEmail, id) });
  }));
});

module.exports = router;
