const { getDatabase } = require('../database/init');

function parseId(req, res, paramName = 'id', entityName = 'ID') {
  const id = parseInt(req.params[paramName]);
  if (isNaN(id)) {
    res.status(400).json({ error: `Invalid ${entityName}` });
    return null;
  }
  return id;
}

function checkOwnership(db, table, id, userEmail, entityName, callback) {
  db.get(
    `SELECT id FROM ${table} WHERE id = ? AND user_email = ?`,
    [id, userEmail],
    (err, row) => {
      if (err) {
        return callback({ status: 500, error: 'Internal server error' });
      }
      if (!row) {
        return callback({ status: 404, error: `${entityName} not found` });
      }
      callback(null, row);
    }
  );
}

function verifyClientBelongsToUser(db, clientId, userEmail, callback) {
  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail],
    (err, row) => {
      if (err) {
        return callback({ status: 500, error: 'Internal server error' });
      }
      if (!row) {
        return callback({ status: 400, error: 'Client not found or does not belong to user' });
      }
      callback(null);
    }
  );
}

function buildUpdateQuery(table, fields, idColumn, userEmailColumn) {
  return (value, id, userEmail) => {
    const updates = [];
    const values = [];

    for (const { key, column } of fields) {
      if (value[key] !== undefined) {
        updates.push(`${column} = ?`);
        values.push(value[key] === '' ? null : value[key]);
      }
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id, userEmail);

    const query = `UPDATE ${table} SET ${updates.join(', ')} WHERE ${idColumn} = ? AND ${userEmailColumn} = ?`;
    return { query, values };
  };
}

function sendDbError(res, message) {
  console.error('Database error:', message);
  return res.status(500).json({ error: message });
}

module.exports = {
  parseId,
  checkOwnership,
  verifyClientBelongsToUser,
  buildUpdateQuery,
  sendDbError
};
