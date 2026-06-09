const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { getDatabase } = require('../database/init');
const { emailSchema, loginSchema, registerSchema, setPasswordSchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});
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
router.post('/register', authLimiter, async (req, res, next) => {
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

      try {
        if (row) {
          return res.status(409).json({ error: 'User already exists' });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        db.run(
          'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
          [email, passwordHash, 'user'],
          function (err) {
            if (err) {
              if (err.code === 'SQLITE_CONSTRAINT') {
                return res.status(409).json({ error: 'User already exists' });
              }
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
      } catch (e) {
        console.error('Error in register:', e);
        return res.status(500).json({ error: 'Internal server error' });
      }
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
router.post('/login', authLimiter, async (req, res, next) => {
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

        try {
          if (!row) {
            return res.status(401).json({ error: 'Invalid email or password' });
          }

          if (!row.password_hash) {
            return res.status(401).json({ error: 'Invalid email or password' });
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
        } catch (e) {
          console.error('Error in login:', e);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });
    } else {
      // Legacy email-only login for backward compatibility
      const { error, value } = emailSchema.validate(req.body);
      if (error) {
        return next(error);
      }

      const { email } = value;
      const db = getDatabase();

      db.get('SELECT email, role, password_hash, created_at FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (row) {
          if (row.password_hash) {
            return res.status(401).json({ error: 'This account requires password authentication. Please provide a password.' });
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

/**
 * @openapi
 * /api/auth/set-password:
 *   post:
 *     summary: Set password for a legacy (email-only) account
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *       - emailHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password set successfully }
 *       400: { description: Account already has a password }
 */
router.post('/set-password', authenticateUser, async (req, res, next) => {
  const { error, value } = setPasswordSchema.validate(req.body);
  if (error) {
    return next(error);
  }
  const { password } = value;

  const db = getDatabase();
  db.get('SELECT password_hash FROM users WHERE email = ?', [req.userEmail], async (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (row.password_hash) {
      return res.status(400).json({ error: 'Account already has a password set' });
    }

    try {
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      db.run('UPDATE users SET password_hash = ? WHERE email = ?', [passwordHash, req.userEmail], function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
        res.json({ message: 'Password set successfully. Use POST /api/auth/login with email and password.' });
      });
    } catch (e) {
      console.error('Error setting password:', e);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
});

/**
 * @openapi
 * /api/auth/promote:
 *   post:
 *     summary: Promote a user to admin (admin-only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: User promoted to admin }
 *       403: { description: Admin access required }
 *       404: { description: User not found }
 */
router.post('/promote', authLimiter, authenticateUser, requireRole('admin'), (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const db = getDatabase();
  db.run('UPDATE users SET role = ? WHERE email = ?', ['admin', email], function (err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: `User ${email} promoted to admin` });
  });
});

module.exports = router;
