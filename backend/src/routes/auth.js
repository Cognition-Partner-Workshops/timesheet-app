const express = require('express');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');
const { emailSchema, otpVerifySchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');
const { sendOtpEmail } = require('../services/email');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const OTP_EXPIRY_MINUTES = 5;

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Step 1: Request OTP — sends a 6-digit code to the provided email
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = emailSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { email } = value;
    const db = getDatabase();
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Invalidate any previous unused OTPs for this email
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE otp_codes SET used = 1 WHERE email = ? AND used = 0',
        [email],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Store new OTP
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)',
        [email, otpCode, expiresAt],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Send OTP email
    try {
      await sendOtpEmail(email, otpCode);
    } catch (emailErr) {
      console.error('Failed to send OTP email:', emailErr);
      return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }

    res.json({
      message: 'Verification code sent to your email',
      email: email,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (error) {
    next(error);
  }
});

// Step 2: Verify OTP — validates the code and returns a JWT
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { error, value } = otpVerifySchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { email, code } = value;
    const db = getDatabase();

    // Look up the most recent unused OTP for this email
    const otpRow = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, code, expires_at FROM otp_codes WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1',
        [email],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    if (!otpRow) {
      return res.status(400).json({ error: 'No pending verification code found. Please request a new one.' });
    }

    // Check expiry
    if (new Date(otpRow.expires_at) < new Date()) {
      // Mark expired OTP as used
      db.run('UPDATE otp_codes SET used = 1 WHERE id = ?', [otpRow.id]);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Check code
    if (otpRow.code !== code) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    // Mark OTP as used
    await new Promise((resolve, reject) => {
      db.run('UPDATE otp_codes SET used = 1 WHERE id = ?', [otpRow.id], (err) =>
        err ? reject(err) : resolve()
      );
    });

    // Create user if they don't exist
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT email, created_at FROM users WHERE email = ?', [email], (err, row) =>
        err ? reject(err) : resolve(row)
      );
    });

    let user;
    if (existingUser) {
      user = { email: existingUser.email, createdAt: existingUser.created_at };
    } else {
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO users (email) VALUES (?)', [email], (err) =>
          err ? reject(err) : resolve()
        );
      });
      user = { email: email, createdAt: new Date().toISOString() };
    }

    // Issue JWT
    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      message: 'Login successful',
      user,
      token,
    });
  } catch (error) {
    next(error);
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res, next) => {
  try {
    const { error, value } = emailSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { email } = value;
    const db = getDatabase();
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Invalidate previous OTPs
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE otp_codes SET used = 1 WHERE email = ? AND used = 0',
        [email],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Store new OTP
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)',
        [email, otpCode, expiresAt],
        (err) => (err ? reject(err) : resolve())
      );
    });

    try {
      await sendOtpEmail(email, otpCode);
    } catch (emailErr) {
      console.error('Failed to resend OTP email:', emailErr);
      return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }

    res.json({
      message: 'A new verification code has been sent to your email',
      email: email,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (error) {
    next(error);
  }
});

// Get current user info (JWT-protected)
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
        createdAt: row.created_at,
      },
    });
  });
});

module.exports = router;
