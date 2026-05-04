const { getDatabase } = require('../database/init');

function parseId(params, resourceName) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return { error: `Invalid ${resourceName} ID`, id: null };
  }
  return { error: null, id };
}

function listAll(query, userEmail, resourceKey, res) {
  const db = getDatabase();
  db.all(query, [userEmail], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json({ [resourceKey]: rows });
  });
}

function getOne(query, params, resourceKey, resourceName, res) {
  const db = getDatabase();
  db.get(query, params, (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!row) {
      return res.status(404).json({ error: `${resourceName} not found` });
    }
    res.json({ [resourceKey]: row });
  });
}

function insertAndReturn(insertSql, insertParams, selectSql, resourceKey, resourceName, res) {
  const db = getDatabase();
  db.run(insertSql, insertParams, function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: `Failed to create ${resourceName}` });
    }
    const lastID = this.lastID;
    db.get(selectSql, [lastID], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: `${resourceName} created but failed to retrieve` });
      }
      res.status(201).json({ message: `${resourceName} created successfully`, [resourceKey]: row });
    });
  });
}

function buildDynamicUpdate(fieldMap, value) {
  const updates = [];
  const values = [];
  for (const [jsField, dbColumn] of Object.entries(fieldMap)) {
    if (value[jsField] !== undefined) {
      updates.push(`${dbColumn} = ?`);
      values.push(value[jsField] === '' ? null : value[jsField]);
    }
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  return { updates, values };
}

function checkExistsThenUpdate(table, resourceId, userEmail, updateQuery, updateValues, selectSql, resourceKey, resourceName, res) {
  const db = getDatabase();
  db.get(`SELECT id FROM ${table} WHERE id = ? AND user_email = ?`, [resourceId, userEmail], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!row) {
      return res.status(404).json({ error: `${resourceName} not found` });
    }
    db.run(updateQuery, updateValues, function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: `Failed to update ${resourceName}` });
      }
      db.get(selectSql, [resourceId], (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: `${resourceName} updated but failed to retrieve` });
        }
        res.json({ message: `${resourceName} updated successfully`, [resourceKey]: row });
      });
    });
  });
}

function deleteAll(table, userEmail, resourceName, res) {
  const db = getDatabase();
  db.run(`DELETE FROM ${table} WHERE user_email = ?`, [userEmail], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: `Failed to delete ${resourceName}s` });
    }
    res.json({ message: `All ${resourceName}s deleted successfully`, deletedCount: this.changes });
  });
}

function checkExistsThenDelete(table, resourceId, userEmail, resourceName, res) {
  const db = getDatabase();
  db.get(`SELECT id FROM ${table} WHERE id = ? AND user_email = ?`, [resourceId, userEmail], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!row) {
      return res.status(404).json({ error: `${resourceName} not found` });
    }
    db.run(`DELETE FROM ${table} WHERE id = ? AND user_email = ?`, [resourceId, userEmail], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: `Failed to delete ${resourceName}` });
      }
      res.json({ message: `${resourceName} deleted successfully` });
    });
  });
}

function verifyOwnership(table, id, userEmail, label) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.get(`SELECT id FROM ${table} WHERE id = ? AND user_email = ?`, [id, userEmail], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve({ valid: false, message: `${label} not found or does not belong to user` });
      resolve({ valid: true });
    });
  });
}

module.exports = {
  parseId,
  listAll,
  getOne,
  insertAndReturn,
  buildDynamicUpdate,
  checkExistsThenUpdate,
  deleteAll,
  checkExistsThenDelete,
  verifyOwnership
};
