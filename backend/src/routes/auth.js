const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');
const { emailSchema, loginSchema, registerSchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-min-32-chars';
const JWT_EXPIRY = '24h';
const SALT_ROUNDS = 10;

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user with password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       201: { description: User registered successfully }
 *       409: { description: User already exists }
 */
router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { email, password } = value;
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

      db.run(
        'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
        [email, passwordHash, 'user'],
        function (err) {
          if (err) {
            console.error('Error creating user:', err);
            return res.status(500).json({ error: 'Failed to create user' });
          }

          const token = jwt.sign({ email, role: 'user' }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

          res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
              email,
              role: 'user',
              createdAt: new Date().toISOString(),
            },
          });
        }
      );
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login (password-based or legacy email-only)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, description: "Optional — omit for legacy email-only login" }
 *     responses:
 *       200: { description: Login successful, returns JWT token }
 *       201: { description: New user created and logged in (legacy mode) }
 *       401: { description: Invalid credentials }
 */
router.post('/login', async (req, res, next) => {
  try {
    // If password is provided, use password-based auth
    if (req.body.password) {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        return next(error);
      }

      const { email, password } = value;
      const db = getDatabase();

      db.get('SELECT email, password_hash, role, created_at FROM users WHERE email = ?', [email], async (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (!row) {
          return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!row.password_hash) {
          return res.status(401).json({ error: 'Account requires password setup. Please register first.' });
        }

        const isValidPassword = await bcrypt.compare(password, row.password_hash);
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ email: row.email, role: row.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

        return res.json({
          message: 'Login successful',
          token,
          user: {
            email: row.email,
            role: row.role,
            createdAt: row.created_at,
          },
        });
      });
    } else {
      // Legacy email-only login for backward compatibility
      const { error, value } = emailSchema.validate(req.body);
      if (error) {
        return next(error);
      }

      const { email } = value;
      const db = getDatabase();

      db.get('SELECT email, role, created_at FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (row) {
          const token = jwt.sign({ email: row.email, role: row.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
          return res.json({
            message: 'Login successful',
            token,
            user: {
              email: row.email,
              role: row.role,
              createdAt: row.created_at,
            },
          });
        } else {
          db.run('INSERT INTO users (email) VALUES (?)', [email], function (err) {
            if (err) {
              console.error('Error creating user:', err);
              return res.status(500).json({ error: 'Failed to create user' });
            }

            const token = jwt.sign({ email, role: 'user' }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

            res.status(201).json({
              message: 'User created and logged in successfully',
              token,
              user: {
                email: email,
                role: 'user',
                createdAt: new Date().toISOString(),
              },
            });
          });
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get current user info
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *       - emailHeader: []
 *     responses:
 *       200: { description: Current user info }
 *       401: { description: Not authenticated }
 */
router.get('/me', authenticateUser, (req, res) => {
  const db = getDatabase();

  db.get('SELECT email, role, created_at FROM users WHERE email = ?', [req.userEmail], (err, row) => {
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
        role: row.role,
        createdAt: row.created_at,
      },
    });
  });
});

module.exports = router;
