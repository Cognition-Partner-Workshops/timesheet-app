const Joi = require('joi');

const clientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  department: Joi.string().trim().max(255).optional().allow(''),
  email: Joi.string().trim().email().max(255).optional().allow('')
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
  email: Joi.string().trim().email().max(255).optional().allow('')
}).min(1); // At least one field must be provided

const emailSchema = Joi.object({
  email: Joi.string().email().required()
});

const journalEntrySchema = Joi.object({
  title: Joi.string().trim().min(1).max(500).required(),
  content: Joi.string().trim().min(1).max(5000).required(),
  source: Joi.string().trim().max(255).optional().allow(''),
  sourceUrl: Joi.string().trim().max(2000).optional().allow(''),
  publishedDate: Joi.date().iso().optional()
});

const updateJournalEntrySchema = Joi.object({
  title: Joi.string().trim().min(1).max(500).optional(),
  content: Joi.string().trim().min(1).max(5000).optional(),
  source: Joi.string().trim().max(255).optional().allow(''),
  sourceUrl: Joi.string().trim().max(2000).optional().allow(''),
  publishedDate: Joi.date().iso().optional()
}).min(1);

module.exports = {
  clientSchema,
  workEntrySchema,
  updateWorkEntrySchema,
  updateClientSchema,
  emailSchema,
  journalEntrySchema,
  updateJournalEntrySchema
};
