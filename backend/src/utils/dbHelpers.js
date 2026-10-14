// Shared query helpers for routes that own user-scoped rows.

function internalError(res, err) {
  console.error('Database error:', err);
  return res.status(500).json({ error: 'Internal server error' });
}

// Fetch a single row; respond with `status`/`missingMessage` when it does not exist.
function findRow(db, query, params, res, missingMessage, status, onFound) {
  db.get(query, params, (err, row) => {
    if (err) {
      return internalError(res, err);
    }

    if (!row) {
      return res.status(status).json({ error: missingMessage });
    }

    onFound(row);
  });
}

// Fetch a row the caller must own, responding 404 when it is missing.
function findOwnedRow(db, query, params, res, missingMessage, onFound) {
  findRow(db, query, params, res, missingMessage, 404, onFound);
}

// Fetch a referenced row, responding 400 when it is missing or not owned.
function requireReference(db, query, params, res, missingMessage, onFound) {
  findRow(db, query, params, res, missingMessage, 400, onFound);
}

// Re-read a row after a write and send it under `key`.
function sendRow(db, query, params, res, { key, entity, action, status }) {
  db.get(query, params, (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: `${entity} ${action} but failed to retrieve` });
    }

    res.status(status).json({
      message: `${entity} ${action} successfully`,
      [key]: row
    });
  });
}

// Build the SET clauses and values for the fields present in a validated payload.
// `fields` maps a payload field to [column, nullable].
function buildUpdates(value, fields) {
  const updates = [];
  const values = [];

  Object.entries(fields).forEach(([field, [column, nullable]]) => {
    if (value[field] !== undefined) {
      updates.push(`${column} = ?`);
      values.push(nullable ? value[field] || null : value[field]);
    }
  });

  updates.push('updated_at = CURRENT_TIMESTAMP');

  return { updates, values };
}

// Parse an integer route parameter, responding 400 when it is not a number.
function parseIdParam(req, res, name, invalidMessage) {
  const id = parseInt(req.params[name]);

  if (isNaN(id)) {
    res.status(400).json({ error: invalidMessage });
    return null;
  }

  return id;
}

module.exports = {
  internalError,
  findOwnedRow,
  requireReference,
  sendRow,
  buildUpdates,
  parseIdParam
};
