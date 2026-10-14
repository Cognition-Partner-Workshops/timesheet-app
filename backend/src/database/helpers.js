const { getDatabase } = require('./init');

function dbAll(query, params = []) {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbGet(query, params = []) {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(query, params = []) {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function parseResourceId(rawId, resourceName) {
  const id = parseInt(rawId);
  if (isNaN(id)) {
    return { id: null, error: `Invalid ${resourceName} ID` };
  }
  return { id, error: null };
}

function buildDynamicUpdate(table, fieldMappings, value) {
  const updates = [];
  const values = [];

  for (const { field, column, nullable } of fieldMappings) {
    if (value[field] !== undefined) {
      updates.push(`${column} = ?`);
      values.push(nullable ? (value[field] || null) : value[field]);
    }
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  return { setClauses: updates.join(', '), values };
}

module.exports = { dbAll, dbGet, dbRun, parseResourceId, buildDynamicUpdate };
