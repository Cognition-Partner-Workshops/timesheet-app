/**
 * Shared helpers for Express route handlers.
 */

/**
 * Parses a route or query parameter as an integer ID.
 *
 * @param {string} value - Raw parameter value (e.g. req.params.id).
 * @returns {number|null} The parsed integer, or null when invalid.
 */
function parseIdParam(value) {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
}

/**
 * Builds Express middleware that validates the `:id` route parameter.
 * On success the parsed integer is stored on `req.parsedId`; otherwise a
 * 400 response is sent.
 *
 * @param {string} label - Resource name used in the error message (e.g. 'client').
 * @returns {import('express').RequestHandler} Validation middleware.
 */
function validateIdParam(label) {
  return (req, res, next) => {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: `Invalid ${label} ID` });
    }
    req.parsedId = id;
    next();
  };
}

/**
 * Builds the SET clause and bound values for a partial UPDATE from the
 * validated request body. Always appends `updated_at = CURRENT_TIMESTAMP`.
 *
 * @param {Array<{column: string, key: string, nullable?: boolean}>} fieldSpecs -
 *   Mapping of DB columns to request-body keys; nullable fields coerce
 *   empty values to NULL.
 * @param {Object} value - Validated request body.
 * @returns {{setClause: string, values: Array}} SQL fragment and bind values.
 */
function buildUpdateSet(fieldSpecs, value) {
  const updates = [];
  const values = [];

  for (const { column, key, nullable } of fieldSpecs) {
    if (value[key] !== undefined) {
      updates.push(`${column} = ?`);
      values.push(nullable ? value[key] || null : value[key]);
    }
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  return { setClause: updates.join(', '), values };
}

/**
 * Logs a database error and sends a 500 JSON error response.
 *
 * @param {import('express').Response} res - Express response object.
 * @param {Error} err - The database error to log.
 * @param {string} [message] - Error message returned to the client.
 */
function handleDbError(res, err, message = 'Internal server error') {
  console.error('Database error:', err);
  return res.status(500).json({ error: message });
}

/** SELECT clause returning a work entry joined with its client's name. */
const WORK_ENTRY_SELECT = `
  SELECT we.id, we.client_id, we.hours, we.description, we.date,
         we.created_at, we.updated_at, c.name as client_name
  FROM work_entries we
  JOIN clients c ON we.client_id = c.id
`;

module.exports = {
  parseIdParam,
  validateIdParam,
  buildUpdateSet,
  handleDbError,
  WORK_ENTRY_SELECT,
};
