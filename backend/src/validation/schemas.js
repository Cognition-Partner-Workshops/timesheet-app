const Joi = require('joi');

const clientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  department: Joi.string().trim().max(255).optional().allow(''),
  email: Joi.string().trim().email().max(255).optional().allow('')
});

const projectSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  clientId: Joi.number().integer().positive().required(),
  startDate: Joi.date().iso().optional().allow(null),
  endDate: Joi.date().iso().optional().allow(null),
  status: Joi.string().valid('active', 'completed', 'on-hold').default('active'),
  budgetHours: Joi.number().min(0).precision(2).optional().allow(null)
});

const updateProjectSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  clientId: Joi.number().integer().positive().optional(),
  startDate: Joi.date().iso().optional().allow(null),
  endDate: Joi.date().iso().optional().allow(null),
  status: Joi.string().valid('active', 'completed', 'on-hold').optional(),
  budgetHours: Joi.number().min(0).precision(2).optional().allow(null)
}).min(1);

const workEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  projectId: Joi.number().integer().positive().optional().allow(null),
  hours: Joi.number().positive().max(24).precision(2).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().required()
});

const updateWorkEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().optional(),
  projectId: Joi.number().integer().positive().optional().allow(null),
  hours: Joi.number().positive().max(24).precision(2).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().optional()
}).min(1);

const updateClientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  department: Joi.string().trim().max(255).optional().allow(''),
  email: Joi.string().trim().email().max(255).optional().allow('')
}).min(1);

const emailSchema = Joi.object({
  email: Joi.string().email().required()
});

module.exports = {
  clientSchema,
  projectSchema,
  updateProjectSchema,
  workEntrySchema,
  updateWorkEntrySchema,
  updateClientSchema,
  emailSchema
};
