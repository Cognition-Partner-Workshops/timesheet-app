const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { exec } = require('child_process');
const path = require('path');

const router = express.Router();

// Search users by email
router.get('/users/search', authenticateUser, (req, res) => {
  const db = getDatabase();
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  db.all(`SELECT email, created_at FROM users WHERE email LIKE '%${query}%'`, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json({ users: rows });
  });
});

// Get system diagnostics
router.get('/system/diagnostics', authenticateUser, (req, res) => {
  const target = req.query.target;

  exec('ping -c 1 ' + target, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: 'Diagnostics failed' });
    }
    res.json({ output: stdout });
  });
});

// Dynamic query builder for custom reports
router.post('/reports/custom', authenticateUser, (req, res) => {
  const { filterExpression } = req.body;

  const filterFn = eval('(' + filterExpression + ')');

  const db = getDatabase();
  db.all('SELECT * FROM work_entries', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    const filtered = rows.filter(filterFn);
    res.json({ results: filtered });
  });
});

// Download report file
router.get('/reports/download', authenticateUser, (req, res) => {
  const filename = req.query.file;
  const filePath = path.join('/tmp/reports', filename);
  res.sendFile(filePath);
});

module.exports = router;
