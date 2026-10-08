const express = require('express');
const { getDatabase } = require('../database/init');
const { logError } = require('../utils/logger');
const { emailSchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Login endpoint - creates user if doesn't exist
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = emailSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { email } = value;
    const db = getDatabase();

    // Check if user exists
    db.get('SELECT email, created_at FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        logError('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (row) {
        // User exists
        return res.json({
          message: 'Login successful',
          user: {
            email: row.email,
            createdAt: row.created_at
          }
        });
      } else {
        // Create new user
        db.run('INSERT INTO users (email) VALUES (?)', [email], function(err) {
          if (err) {
            logError('Error creating user:', err);
            return res.status(500).json({ error: 'Failed to create user' });
          }

          res.status(201).json({
            message: 'User created and logged in successfully',
            user: {
              email: email,
              createdAt: new Date().toISOString()
            }
          });
        });
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get current user info
router.get('/me', authenticateUser, (req, res) => {
  const db = getDatabase();
  
  db.get('SELECT email, created_at FROM users WHERE email = ?', [req.userEmail], (err, row) => {
    if (err) {
      logError('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        email: row.email,
        createdAt: row.created_at
      }
    });
  });
});

// GDPR Art. 15/20: export all personal data held for the authenticated user
router.get('/me/export', authenticateUser, (req, res) => {
  const db = getDatabase();

  db.get('SELECT email, created_at FROM users WHERE email = ?', [req.userEmail], (err, user) => {
    if (err) {
      logError('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.all(
      'SELECT id, name, description, department, email, created_at, updated_at FROM clients WHERE user_email = ? ORDER BY id',
      [req.userEmail],
      (err, clients) => {
        if (err) {
          logError('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        db.all(
          'SELECT id, client_id, hours, description, date, created_at, updated_at FROM work_entries WHERE user_email = ? ORDER BY id',
          [req.userEmail],
          (err, workEntries) => {
            if (err) {
              logError('Database error:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }

            res.setHeader('Content-Disposition', 'attachment; filename="my-data-export.json"');
            res.json({
              exportedAt: new Date().toISOString(),
              user: { email: user.email, createdAt: user.created_at },
              clients,
              workEntries
            });
          }
        );
      }
    );
  });
});

// GDPR Art. 17: erase the authenticated user and all of their data
router.delete('/me', authenticateUser, (req, res) => {
  const db = getDatabase();
  const steps = [
    'DELETE FROM work_entries WHERE user_email = ?',
    'DELETE FROM clients WHERE user_email = ?',
    'DELETE FROM users WHERE email = ?'
  ];

  const runStep = (index) => {
    if (index === steps.length) {
      return res.json({ message: 'Account and all associated data deleted' });
    }
    db.run(steps[index], [req.userEmail], (err) => {
      if (err) {
        logError('Database error:', err);
        return res.status(500).json({ error: 'Failed to delete account' });
      }
      runStep(index + 1);
    });
  };

  runStep(0);
});

module.exports = router;
