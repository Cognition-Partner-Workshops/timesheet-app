const express = require('express');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');
const { emailSchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';

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
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      const sendTokenResponse = (userEmail, createdAt, statusCode, message) => {
        const token = jwt.sign({ email: userEmail }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        return res.status(statusCode).json({
          message,
          token,
          user: {
            email: userEmail,
            createdAt
          }
        });
      };

      if (row) {
        // User exists
        return sendTokenResponse(row.email, row.created_at, 200, 'Login successful');
      } else {
        // Create new user
        db.run('INSERT INTO users (email) VALUES (?)', [email], function(err) {
          if (err) {
            console.error('Error creating user:', err);
            return res.status(500).json({ error: 'Failed to create user' });
          }

          return sendTokenResponse(email, new Date().toISOString(), 201, 'User created and logged in successfully');
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
      console.error('Database error:', err);
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

module.exports = router;
