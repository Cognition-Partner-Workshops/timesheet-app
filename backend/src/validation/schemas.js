const Joi = require('joi');

const hourlyRate = Joi.number().min(0).max(100000).precision(2).optional().allow(null);
const currency = Joi.string().trim().uppercase().pattern(/^[A-Z]{3}$/).optional();
const billingAddress = Joi.string().trim().max(1000).optional().allow('');

const clientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  department: Joi.string().trim().max(255).optional().allow(''),
  email: Joi.string().trim().email().max(255).optional().allow(''),
  hourlyRate,
  currency,
  billingAddress
});

const workEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  hours: Joi.number().positive().max(24).precision(2).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().required()
});

const updateWorkEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().optional(),
  hours: Joi.number().positive().max(24).precision(2).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().optional()
}).min(1); // At least one field must be provided

const updateClientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  department: Joi.string().trim().max(255).optional().allow(''),
  email: Joi.string().trim().email().max(255).optional().allow(''),
  hourlyRate,
  currency,
  billingAddress
}).min(1); // At least one field must be provided

const INVOICE_STATUSES = ['draft', 'issued', 'paid', 'void'];

const invoicePeriodFields = {
  clientId: Joi.number().integer().positive().required(),
  periodStart: Joi.date().iso().required(),
  periodEnd: Joi.date().iso().min(Joi.ref('periodStart')).required()
    .messages({ 'date.min': '"periodEnd" must be on or after "periodStart"' })
};

const invoicePreviewQuerySchema = Joi.object(invoicePeriodFields);

const createInvoiceSchema = Joi.object({
  ...invoicePeriodFields,
  dueDate: Joi.date().iso().optional().allow(null),
  notes: Joi.string().trim().max(1000).optional().allow(''),
  workEntryIds: Joi.array().items(Joi.number().integer().positive()).min(1).unique().optional()
});

const invoiceListQuerySchema = Joi.object({
  clientId: Joi.number().integer().positive().optional(),
  status: Joi.string().valid(...INVOICE_STATUSES).optional()
});

const updateInvoiceStatusSchema = Joi.object({
  status: Joi.string().valid('issued', 'paid', 'void').required()
});

const emailSchema = Joi.object({
  email: Joi.string().email().required()
});

module.exports = {
  clientSchema,
  workEntrySchema,
  updateWorkEntrySchema,
  updateClientSchema,
  emailSchema,
  INVOICE_STATUSES,
  invoicePreviewQuerySchema,
  createInvoiceSchema,
  invoiceListQuerySchema,
  updateInvoiceStatusSchema
};
