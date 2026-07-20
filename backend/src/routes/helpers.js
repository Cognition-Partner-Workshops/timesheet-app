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
  handleDbError,
  WORK_ENTRY_SELECT,
};
