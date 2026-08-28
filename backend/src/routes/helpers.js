const { getDatabase } = require('../database/init');

function parseResourceId(req, res, resourceName) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: `Invalid ${resourceName} ID` });
    return null;
  }
  return id;
}

function handleDbError(res, err, message) {
  console.error('Database error:', err);
  return res.status(500).json({ error: message || 'Internal server error' });
}

function findOwnedResource(table, id, userEmail, callback) {
  const db = getDatabase();
  db.get(
    `SELECT id FROM ${table} WHERE id = ? AND user_email = ?`,
    [id, userEmail],
    callback
  );
}

function verifyClientOwnership(clientId, userEmail, res, callback) {
  if (!clientId) return callback();
  const db = getDatabase();
  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail],
    (err, row) => {
      if (err) return handleDbError(res, err);
      if (!row) return res.status(400).json({ error: 'Client not found or does not belong to user' });
      callback();
    }
  );
}

function buildDynamicUpdate(table, fieldMap, value) {
  const updates = [];
  const values = [];

  for (const [jsKey, dbConfig] of Object.entries(fieldMap)) {
    if (value[jsKey] !== undefined) {
      updates.push(`${dbConfig.column} = ?`);
      values.push(dbConfig.nullable ? (value[jsKey] || null) : value[jsKey]);
    }
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  return { updates, values };
}

module.exports = {
  parseResourceId,
  handleDbError,
  findOwnedResource,
  verifyClientOwnership,
  buildDynamicUpdate
};
