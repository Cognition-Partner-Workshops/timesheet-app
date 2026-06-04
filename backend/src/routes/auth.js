const express = require('express');
const { getDatabase } = require('../database/init');
const { emailSchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');
const { isOidcEnabled, getOidcConfig, verifyOidcToken } = require('../middleware/oidc');

const router = express.Router();

/**
 * Finds an existing user or creates a new one, then calls back with the result.
 * Shared by both login flows.
 */
function findOrCreateUser(email, callback) {
  const db = getDatabase();

  db.get('SELECT email, created_at FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return callback({ status: 500, body: { error: 'Internal server error' } });
    }

    if (row) {
      return callback(null, { isNew: false, user: { email: row.email, createdAt: row.created_at } });
    }

    db.run('INSERT INTO users (email) VALUES (?)', [email], function (insertErr) {
      if (insertErr) {
        console.error('Error creating user:', insertErr);
        return callback({ status: 500, body: { error: 'Failed to create user' } });
      }
      callback(null, { isNew: true, user: { email, createdAt: new Date().toISOString() } });
    });
  });
}

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

    findOrCreateUser(email, (err, result) => {
      if (err) return res.status(err.status).json(err.body);

      const status = result.isNew ? 201 : 200;
      const message = result.isNew ? 'User created and logged in successfully' : 'Login successful';
      res.status(status).json({
        message,
        user: result.user,
        oidc: { subject, issuer: claims.iss },
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

    findOrCreateUser(value.email, (err, result) => {
      if (err) return res.status(err.status).json(err.body);

      const status = result.isNew ? 201 : 200;
      const message = result.isNew ? 'User created and logged in successfully' : 'Login successful';
      res.status(status).json({ message, user: result.user });
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
