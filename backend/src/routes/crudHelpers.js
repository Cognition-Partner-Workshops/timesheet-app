const { getDatabase } = require('../database/init');

function parseId(req, res, resourceName) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: `Invalid ${resourceName} ID` });
    return null;
  }
  return id;
}

function validateBody(schema, req, res, next) {
  const { error, value } = schema.validate(req.body);
  if (error) {
    next(error);
    return null;
  }
  return value;
}

function findOwned(table, id, userEmail, callback) {
  const db = getDatabase();
  db.get(
    `SELECT id FROM ${table} WHERE id = ? AND user_email = ?`,
    [id, userEmail],
    callback
  );
}

function buildUpdateQuery(table, fieldMap, value) {
  const updates = [];
  const values = [];

  for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
    if (value[jsKey] !== undefined) {
      updates.push(`${dbCol} = ?`);
      values.push(value[jsKey] === '' ? null : value[jsKey]);
    }
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  return { updates, values };
}

module.exports = { parseId, validateBody, findOwned, buildUpdateQuery };
