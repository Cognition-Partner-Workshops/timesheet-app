const Joi = require('joi');

/** Field length limits shared by the client and work-entry schemas. */
const MAX_NAME_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_EMAIL_LENGTH = 255;
/** Upper bound for hours logged on a single work entry. */
const MAX_HOURS_PER_ENTRY = 24;
/** Decimal places kept for hours (e.g. 1.25). */
const HOURS_PRECISION = 2;

/**
 * Returns a copy of `schema` with every key made optional and at least one
 * key required, so PUT endpoints accept partial updates.
 */
function toPartialUpdateSchema(schema) {
  const keys = Object.keys(schema.describe().keys);
  return schema.fork(keys, (field) => field.optional()).min(1);
}

/** Request body for POST /api/clients. */
const clientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(MAX_NAME_LENGTH).required(),
  description: Joi.string().trim().max(MAX_DESCRIPTION_LENGTH).optional().allow(''),
  department: Joi.string().trim().max(MAX_NAME_LENGTH).optional().allow(''),
  email: Joi.string().trim().email().max(MAX_EMAIL_LENGTH).optional().allow('')
});

/** Request body for POST /api/work-entries. */
const workEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  hours: Joi.number().positive().max(MAX_HOURS_PER_ENTRY).precision(HOURS_PRECISION).required(),
  description: Joi.string().trim().max(MAX_DESCRIPTION_LENGTH).optional().allow(''),
  date: Joi.date().iso().required()
});

/** Request body for PUT /api/work-entries/:id (partial update). */
const updateWorkEntrySchema = toPartialUpdateSchema(workEntrySchema);

/** Request body for PUT /api/clients/:id (partial update). */
const updateClientSchema = toPartialUpdateSchema(clientSchema);

/** Request body for POST /api/auth/login. */
const emailSchema = Joi.object({
  email: Joi.string().email().required()
});

module.exports = {
  clientSchema,
  workEntrySchema,
  updateWorkEntrySchema,
  updateClientSchema,
  emailSchema
};
