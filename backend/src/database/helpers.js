const { getDatabase } = require('./init');

function findAll(query, params) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function findOne(query, params) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function runQuery(query, params) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function buildUpdateQuery(table, fields, whereClause) {
  const updates = [];
  const values = [];

  for (const [column, value] of Object.entries(fields)) {
    if (value !== undefined) {
      updates.push(`${column} = ?`);
      values.push(value);
    }
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  const query = `UPDATE ${table} SET ${updates.join(', ')} WHERE ${whereClause}`;
  return { query, values };
}

module.exports = {
  findAll,
  findOne,
  runQuery,
  buildUpdateQuery
};
