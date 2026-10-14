const express = require('express');
const { getDatabase } = require('../database/init');
const { emailSchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

/** Maps a `users` row to the camelCased shape returned by the auth API. */
function toUserResponse(row) {
  return {
    email: row.email,
    createdAt: row.created_at
  };
}

/**
 * POST /api/auth/login
 * Passwordless login: returns the existing user for `email`, or creates one
 * (201) on first login. Responds with `{ message, user: { email, createdAt } }`.
 */
router.post('/login', (req, res, next) => {
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
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (row) {
        return res.json({
          message: 'Login successful',
          user: toUserResponse(row)
        });
      }

      db.run('INSERT INTO users (email) VALUES (?)', [email], function(err) {
        if (err) {
          console.error('Error creating user:', err);
          return res.status(500).json({ error: 'Failed to create user' });
        }

        res.status(201).json({
          message: 'User created and logged in successfully',
          user: { email, createdAt: new Date().toISOString() }
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile as `{ user: { email, createdAt } }`.
 */
router.get('/me', authenticateUser, (req, res) => {
  const db = getDatabase();
  
  db.get('SELECT email, created_at FROM users WHERE email = ?', [req.userEmail], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: toUserResponse(row) });
  });
});

module.exports = router;
