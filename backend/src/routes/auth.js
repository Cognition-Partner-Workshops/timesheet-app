const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { getDatabase } = require('../database/init');
const { loginSchema, registerSchema } = require('../validation/schemas');
const { authenticateUser, getJwtSecret } = require('../middleware/auth');

const router = express.Router();

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = '24h';

// Strict rate limiting for login/register only (Fix #3)
// Not applied to GET /me to avoid locking out normal users
const isTestEnv = process.env.NODE_ENV === 'test';
const authLimiter = isTestEnv
  ? (req, res, next) => next() // Skip rate limiting in tests
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 auth attempts per window
      message: { error: 'Too many authentication attempts, please try again after 15 minutes' },
      standardHeaders: true,
      legacyHeaders: false
    });

// Register endpoint - creates a new user with password
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { email, password } = value;
    const db = getDatabase();

    // Check if user already exists
    db.get('SELECT email FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (row) {
        return res.status(409).json({ error: 'User already exists' });
      }

      try {
        // Hash the password
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Create new user
        db.run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, passwordHash], function(err) {
          if (err) {
            console.error('Error creating user:', err);
            return res.status(500).json({ error: 'Failed to create user' });
          }

          // Generate JWT token
          const token = jwt.sign({ email }, getJwtSecret(), { expiresIn: JWT_EXPIRY });

          res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
              email: email,
              createdAt: new Date().toISOString()
            }
          });
        });
      } catch (hashError) {
        console.error('Error hashing password:', hashError);
        return res.status(500).json({ error: 'Internal server error' });
      }
    });
  } catch (error) {
    next(error);
  }
});

// Login endpoint - authenticates with email and password
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { email, password } = value;
    const db = getDatabase();

    // Check if user exists
    db.get('SELECT email, password_hash, created_at FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!row) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      try {
        // Verify password
        const isValidPassword = await bcrypt.compare(password, row.password_hash);

        if (!isValidPassword) {
          return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign({ email: row.email }, getJwtSecret(), { expiresIn: JWT_EXPIRY });

        res.json({
          message: 'Login successful',
          token,
          user: {
            email: row.email,
            createdAt: row.created_at
          }
        });
      } catch (compareError) {
        console.error('Error comparing password:', compareError);
        return res.status(500).json({ error: 'Internal server error' });
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
