/**
 * Shared helpers for Express route handlers.
 */

/**
 * Creates middleware that validates a numeric route parameter.
 *
 * On success the parsed integer replaces the raw string in `req.params`, so
 * downstream handlers can read `req.params[paramName]` as a number. On failure
 * the request is rejected with `400 { error: 'Invalid <label> ID' }`.
 *
 * @param {string} paramName - Name of the route parameter (e.g. `'id'`).
 * @param {string} label - Human-readable resource name used in the error message.
 * @returns {import('express').RequestHandler}
 */
function validateIdParam(paramName, label) {
  return (req, res, next) => {
    const id = Number.parseInt(req.params[paramName], 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: `Invalid ${label} ID` });
    }

    req.params[paramName] = id;
    next();
  };
}

/**
 * Builds the `SET` clause of a partial UPDATE from validated request data.
 *
 * Only fields present in `data` are included. Fields marked `nullable` store
 * `NULL` when the incoming value is falsy (e.g. an empty string). An
 * `updated_at = CURRENT_TIMESTAMP` assignment is always appended.
 *
 * @param {Object} data - Validated request body (undefined keys are skipped).
 * @param {Array<{ key: string, column: string, nullable?: boolean }>} fields
 *   Mapping of request keys to table columns.
 * @returns {{ setClause: string, values: Array }} SQL fragment and bound values.
 */
function buildUpdateSet(data, fields) {
  const assignments = [];
  const values = [];

  for (const { key, column, nullable } of fields) {
    if (data[key] === undefined) {
      continue;
    }

    assignments.push(`${column} = ?`);
    values.push(nullable ? data[key] || null : data[key]);
  }

  assignments.push('updated_at = CURRENT_TIMESTAMP');

  return { setClause: assignments.join(', '), values };
}

module.exports = {
  validateIdParam,
  buildUpdateSet
};
