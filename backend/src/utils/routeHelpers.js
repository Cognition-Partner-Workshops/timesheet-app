// Shared helpers for route handlers.

// Parse a route/query parameter into a positive integer id.
// Returns the parsed integer, or null when the value is not a valid number.
function parseId(value) {
  const id = parseInt(value);
  return Number.isNaN(id) ? null : id;
}

// Log a database error and send a 500 response with the given message.
function sendDbError(res, err, message = 'Internal server error') {
  console.error('Database error:', err);
  return res.status(500).json({ error: message });
}

// Build the SET clause and parameters for a dynamic UPDATE statement.
// `fields` is an ordered list of { column, value, include } entries; only
// entries with `include === true` are added. An `updated_at` bump is always
// appended. Returns { setClause, params } where `params` matches the columns
// in order (the caller appends WHERE parameters).
function buildUpdateClause(fields) {
  const assignments = [];
  const params = [];

  for (const { column, value, include } of fields) {
    if (include) {
      assignments.push(`${column} = ?`);
      params.push(value);
    }
  }

  assignments.push('updated_at = CURRENT_TIMESTAMP');

  return { setClause: assignments.join(', '), params };
}

module.exports = {
  parseId,
  sendDbError,
  buildUpdateClause
};
