const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');
const { loginSchema, registerSchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret';
const JWT_EXPIRES_IN = '24h';
const SALT_ROUNDS = 10;

// Register endpoint - creates a new user with password
router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { email, password, name } = value;
    const db = getDatabase();

    db.get('SELECT email FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (row) {
        return res.status(409).json({ error: 'User already exists' });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // First user gets admin role
      db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        const role = result.count === 0 ? 'admin' : 'user';

        db.run(
          'INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)',
          [email, passwordHash, role, name || null],
          function(err) {
            if (err) {
              console.error('Error creating user:', err);
              return res.status(500).json({ error: 'Failed to create user' });
            }

            const token = jwt.sign({ email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

            res.status(201).json({
              message: 'User created and logged in successfully',
              token,
              user: {
                email,
                name: name || null,
                role,
                createdAt: new Date().toISOString()
              }
            });
          }
        );
      });
    });
  } catch (error) {
    next(error);
  }
});

// Login endpoint - authenticates with email and password
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { email, password } = value;
    const db = getDatabase();

    db.get('SELECT email, password_hash, role, name, created_at FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!row) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Support legacy users without passwords (passwordless migration)
      if (!row.password_hash) {
        return res.status(401).json({ error: 'Account requires password setup. Please register again.' });
      }

      const isMatch = await bcrypt.compare(password, row.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign({ email: row.email, role: row.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      res.json({
        message: 'Login successful',
        token,
        user: {
          email: row.email,
          name: row.name || null,
          role: row.role,
          createdAt: row.created_at
        }
      });
    });
  } catch (error) {
    next(error);
  }
});

// Get current user info
router.get('/me', authenticateUser, (req, res) => {
  const db = getDatabase();
  
  db.get('SELECT email, role, name, created_at FROM users WHERE email = ?', [req.userEmail], (err, row) => {
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
        name: row.name || null,
        role: row.role,
        createdAt: row.created_at
      }
    });
  });
});

module.exports = router;
