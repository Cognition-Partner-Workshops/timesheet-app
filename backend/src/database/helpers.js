const { getDatabase } = require('./init');

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

function buildUpdateQuery(table, fields, id, userEmail) {
  const updates = [];
  const values = [];

  for (const [column, value] of Object.entries(fields)) {
    if (value !== undefined) {
      updates.push(`${column} = ?`);
      values.push(value === '' ? null : value);
    }
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id, userEmail);

  return {
    query: `UPDATE ${table} SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`,
    values
  };
}

module.exports = { dbAll, dbGet, dbRun, buildUpdateQuery };
