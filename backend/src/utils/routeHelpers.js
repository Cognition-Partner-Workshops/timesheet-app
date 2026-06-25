/**
 * Shared route helper utilities to reduce code duplication across CRUD routes.
 */

/**
 * Parse and validate an integer ID from route params.
 * Returns the parsed ID or sends a 400 response and returns null.
 */
function parseId(req, res, entityName) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: `Invalid ${entityName} ID` });
    return null;
  }
  return id;
}

/**
 * Build a dynamic UPDATE query from validated fields.
 * @param {string} table - Table name
 * @param {Object} value - Validated update payload
 * @param {Object} fieldMap - Maps payload keys to column names
 * @param {Array} whereParams - Additional WHERE clause params [id, userEmail]
 * @returns {{ query: string, values: Array }}
 */
function buildUpdateQuery(table, value, fieldMap, whereParams) {
  const updates = [];
  const values = [];

  for (const [key, column] of Object.entries(fieldMap)) {
    if (value[key] !== undefined) {
      updates.push(`${column} = ?`);
      values.push(value[key] || null);
    }
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(...whereParams);

  const query = `UPDATE ${table} SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;
  return { query, values };
}

/**
 * Standard database error handler for route callbacks.
 */
function handleDbError(res, err, message) {
  console.error('Database error:', err);
  return res.status(500).json({ error: message || 'Internal server error' });
}

module.exports = {
  parseId,
  buildUpdateQuery,
  handleDbError
};
