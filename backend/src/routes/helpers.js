const { getDatabase } = require('../database/init');

function parseId(req, res, entityName) {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: `Invalid ${entityName} ID` });
    return null;
  }
  return id;
}

function findOwned(table, id, userEmail) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.get(
      `SELECT id FROM ${table} WHERE id = ? AND user_email = ?`,
      [id, userEmail],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });
}

function buildUpdateQuery(table, fields, id, userEmail) {
  const updates = [];
  const values = [];

  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) {
      updates.push(`${col} = ?`);
      values.push(val);
    }
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id, userEmail);

  return {
    sql: `UPDATE ${table} SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`,
    params: values
  };
}

module.exports = { parseId, findOwned, buildUpdateQuery };
