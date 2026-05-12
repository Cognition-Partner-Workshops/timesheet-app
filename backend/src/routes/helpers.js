const { getDatabase } = require('../database/init');

function validateId(req, res, paramName = 'id') {
  const id = parseInt(req.params[paramName]);
  if (isNaN(id)) return null;
  return id;
}

function dbAll(query, params) {
  return new Promise((resolve, reject) => {
    getDatabase().all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbGet(query, params) {
  return new Promise((resolve, reject) => {
    getDatabase().get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(query, params) {
  return new Promise((resolve, reject) => {
    getDatabase().run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function buildUpdateQuery(table, fields, valueMap, idColumn, idValue, userEmail) {
  const updates = [];
  const values = [];

  for (const field of fields) {
    if (valueMap[field.key] !== undefined) {
      updates.push(`${field.column} = ?`);
      values.push(valueMap[field.key] ?? null);
    }
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(idValue, userEmail);

  return {
    query: `UPDATE ${table} SET ${updates.join(', ')} WHERE ${idColumn} = ? AND user_email = ?`,
    values
  };
}

module.exports = {
  validateId,
  dbAll,
  dbGet,
  dbRun,
  buildUpdateQuery
};
