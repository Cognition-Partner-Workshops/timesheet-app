function parseId(req, res, resourceName) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: `Invalid ${resourceName} ID` });
    return null;
  }
  return id;
}

function buildUpdateQuery(table, fields, value, id, userEmail) {
  const updates = [];
  const values = [];

  for (const { column, key, transform } of fields) {
    const k = key || column;
    if (value[k] !== undefined) {
      updates.push(`${column} = ?`);
      values.push(transform ? transform(value[k]) : value[k]);
    }
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id, userEmail);

  return {
    query: `UPDATE ${table} SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`,
    values
  };
}

function dbAll(db, query, params) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbGet(db, query, params) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(db, query, params) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

module.exports = {
  parseId,
  buildUpdateQuery,
  dbAll,
  dbGet,
  dbRun
};
