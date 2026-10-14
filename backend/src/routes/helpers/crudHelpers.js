function parseIdParam(req, res, entityName) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: `Invalid ${entityName} ID` });
    return null;
  }
  return id;
}

function handleDbError(res, err, message = 'Internal server error') {
  console.error('Database error:', err);
  return res.status(500).json({ error: message });
}

function findByIdAndUser(db, table, id, userEmail, callback) {
  db.get(
    `SELECT id FROM ${table} WHERE id = ? AND user_email = ?`,
    [id, userEmail],
    callback
  );
}

function deleteByIdAndUser(db, res, table, entityName, id, userEmail) {
  findByIdAndUser(db, table, id, userEmail, (err, row) => {
    if (err) return handleDbError(res, err);
    if (!row) return res.status(404).json({ error: `${entityName} not found` });

    db.run(
      `DELETE FROM ${table} WHERE id = ? AND user_email = ?`,
      [id, userEmail],
      function(err) {
        if (err) return handleDbError(res, err, `Failed to delete ${entityName.toLowerCase()}`);
        res.json({ message: `${entityName} deleted successfully` });
      }
    );
  });
}

function buildUpdateQuery(table, fieldMap, values, id, userEmail) {
  const updates = [];
  for (const [key, val] of Object.entries(fieldMap)) {
    if (val !== undefined) {
      updates.push(`${key} = ?`);
      values.push(val);
    }
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id, userEmail);
  return `UPDATE ${table} SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;
}

module.exports = {
  parseIdParam,
  handleDbError,
  findByIdAndUser,
  deleteByIdAndUser,
  buildUpdateQuery
};
