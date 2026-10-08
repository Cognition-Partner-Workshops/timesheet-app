const Joi = require('joi');

// Calendar date as a YYYY-MM-DD string. Joi.date() would convert it to a JS
// Date, which sqlite3 stores as epoch milliseconds.
const isoDateOnly = () => Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      return helpers.error('any.invalid');
    }
    return value;
  })
  .messages({
    'string.pattern.base': '{{#label}} must be a date in YYYY-MM-DD format',
    'any.invalid': '{{#label}} must be a valid calendar date',
  });

const currency = () => Joi.string().trim().uppercase().pattern(/^[A-Z]{3}$/)
  .messages({ 'string.pattern.base': '{{#label}} must be a 3-letter ISO 4217 currency code' });
const cents = () => Joi.number().integer().min(0).max(100000000000);
const taxRateBp = () => Joi.number().integer().min(0).max(10000);
const paymentTermsDays = () => Joi.number().integer().min(0).max(365);

const clientBillingFields = {
  hourlyRateCents: cents().allow(null).optional(),
  currency: currency().allow(null).optional(),
  billingAddress: Joi.string().trim().max(1000).allow('', null).optional(),
  billingEmail: Joi.string().trim().email().max(255).allow('', null).optional(),
  paymentTermsDays: paymentTermsDays().allow(null).optional()
};

const clientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  department: Joi.string().trim().max(255).optional().allow(''),
  email: Joi.string().trim().email().max(255).optional().allow(''),
  ...clientBillingFields
});

const workEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  hours: Joi.number().positive().max(24).precision(2).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: isoDateOnly().required()
});

const updateWorkEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().optional(),
  hours: Joi.number().positive().max(24).precision(2).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: isoDateOnly().optional()
}).min(1); // At least one field must be provided

const updateClientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  department: Joi.string().trim().max(255).optional().allow(''),
  email: Joi.string().trim().email().max(255).optional().allow(''),
  ...clientBillingFields
}).min(1); // At least one field must be provided

const emailSchema = Joi.object({
  email: Joi.string().email().required()
});

const billingProfileSchema = Joi.object({
  businessName: Joi.string().trim().max(255).allow('', null).optional(),
  address: Joi.string().trim().max(1000).allow('', null).optional(),
  taxId: Joi.string().trim().max(100).allow('', null).optional(),
  invoicePrefix: Joi.string().trim().pattern(/^[A-Za-z0-9-]{1,10}$/).optional()
    .messages({ 'string.pattern.base': '{{#label}} may only contain letters, digits and dashes (max 10)' }),
  defaultCurrency: currency().optional(),
  defaultTaxRateBp: taxRateBp().optional(),
  defaultPaymentTermsDays: paymentTermsDays().optional()
});

const invoiceLineSchema = Joi.object({
  workEntryId: Joi.number().integer().positive().optional(),
  date: isoDateOnly().allow(null).optional(),
  description: Joi.string().trim().max(1000).allow('').optional(),
  quantity: Joi.number().positive().max(100000).precision(2).optional(),
  unitPriceCents: cents().allow(null).optional()
}).or('workEntryId', 'description');

const invoiceSchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  periodStart: isoDateOnly().allow(null).optional(),
  periodEnd: isoDateOnly().allow(null).optional(),
  issueDate: isoDateOnly().optional(),
  dueDate: isoDateOnly().optional(),
  currency: currency().optional(),
  taxRateBp: taxRateBp().optional(),
  notes: Joi.string().trim().max(2000).allow('', null).optional(),
  lines: Joi.array().items(invoiceLineSchema).max(500).default([])
});

const updateInvoiceSchema = invoiceSchema
  .fork(['clientId'], (field) => field.optional())
  .keys({ lines: Joi.array().items(invoiceLineSchema).max(500).optional() })
  .min(1);

const markPaidSchema = Joi.object({
  paidDate: isoDateOnly().optional()
});

const voidInvoiceSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(500).required()
});

module.exports = {
  isoDateOnly,
  billingProfileSchema,
  invoiceSchema,
  updateInvoiceSchema,
  markPaidSchema,
  voidInvoiceSchema,
  clientSchema,
  workEntrySchema,
  updateWorkEntrySchema,
  updateClientSchema,
  emailSchema
};
