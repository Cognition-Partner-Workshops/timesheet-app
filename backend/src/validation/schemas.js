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

const projectSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  clientId: Joi.number().integer().positive().optional().allow(null),
  startDate: Joi.date().iso().optional().allow(null, ''),
  endDate: Joi.date().iso().optional().allow(null, '').custom((value, helpers) => {
    const startDate = helpers.state.ancestors[0].startDate;
    if (value && startDate && new Date(value) < new Date(startDate)) {
      return helpers.error('date.endBeforeStart');
    }
    return value;
  }),
  status: Joi.string().trim().valid('active', 'completed', 'on-hold').optional().default('active')
}).messages({
  'date.endBeforeStart': 'End date must not be before start date'
});

const updateProjectSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  clientId: Joi.number().integer().positive().optional().allow(null),
  startDate: Joi.date().iso().optional().allow(null, ''),
  endDate: Joi.date().iso().optional().allow(null, '').custom((value, helpers) => {
    const startDate = helpers.state.ancestors[0].startDate;
    if (value && startDate && new Date(value) < new Date(startDate)) {
      return helpers.error('date.endBeforeStart');
    }
    return value;
  }),
  status: Joi.string().trim().valid('active', 'completed', 'on-hold').optional()
}).min(1).messages({
  'date.endBeforeStart': 'End date must not be before start date'
});

const emailSchema = Joi.object({
  email: Joi.string().email().required()
});

module.exports = {
  clientSchema,
  workEntrySchema,
  updateWorkEntrySchema,
  updateClientSchema,
  projectSchema,
  updateProjectSchema,
  emailSchema
};
