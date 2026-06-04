const express = require('express');
const { getDatabase } = require('../database/init');
const { emailSchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');
const { isOidcEnabled, getOidcConfig, verifyOidcToken } = require('../middleware/oidc');

const router = express.Router();

// Expose OIDC configuration to the frontend
router.get('/oidc/config', (req, res) => {
  if (!isOidcEnabled()) {
    return res.json({ enabled: false });
  }

  const config = getOidcConfig();
  res.json({
    enabled: true,
    issuerUrl: config.issuerUrl,
    audience: config.audience || null,
  });
});

// Token-based login (OIDC flow)
router.post('/token', async (req, res, next) => {
  try {
    if (!isOidcEnabled()) {
      return res.status(400).json({ error: 'OIDC is not enabled on this server' });
    }

    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }

    let tokenPayload;
    try {
      tokenPayload = await verifyOidcToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { email, subject, claims } = tokenPayload;
    const db = getDatabase();

    db.get('SELECT email, created_at FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (row) {
        return res.json({
          message: 'Login successful',
          user: { email: row.email, createdAt: row.created_at },
          oidc: { subject, issuer: claims.iss },
        });
      }

      db.run('INSERT INTO users (email) VALUES (?)', [email], function (insertErr) {
        if (insertErr) {
          console.error('Error creating user:', insertErr);
          return res.status(500).json({ error: 'Failed to create user' });
        }

        res.status(201).json({
          message: 'User created and logged in successfully',
          user: { email, createdAt: new Date().toISOString() },
          oidc: { subject, issuer: claims.iss },
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

// Legacy email-only login (kept for backward compatibility / dev mode)
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
            console.error('Error creating user:', err);
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
