const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateUser);

// Get audit logs for authenticated user
router.get('/', (req, res) => {
  const { entityType, action, limit, offset } = req.query;
  const db = getDatabase();

  let query = 'SELECT id, user_email, action, entity_type, entity_id, details, created_at FROM audit_logs WHERE user_email = ?';
  const params = [req.userEmail];

  if (entityType) {
    query += ' AND entity_type = ?';
    params.push(entityType);
  }

  if (action) {
    query += ' AND action = ?';
    params.push(action);
  }

  query += ' ORDER BY created_at DESC';

  const queryLimit = Math.min(parseInt(limit) || 50, 200);
  const queryOffset = parseInt(offset) || 0;
  query += ' LIMIT ? OFFSET ?';
  params.push(queryLimit, queryOffset);

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const parsed = rows.map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null
    }));

    res.json({ auditLogs: parsed });
  });
});

module.exports = router;
