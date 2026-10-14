const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.includes('change-this')) {
  console.warn(
    'WARNING: JWT_SECRET is not set or is using the default placeholder. ' +
    'Set a strong, random JWT_SECRET environment variable for production use.'
  );
}

// JWT-based authentication middleware
function authenticateUser(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Provide a valid Bearer token.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userEmail = decoded.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'Invalid token: missing email claim' });
    }

    const db = getDatabase();

    // Verify user exists in the database
    db.get('SELECT email FROM users WHERE email = ?', [userEmail], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!row) {
        return res.status(401).json({ error: 'User not found. Please log in again.' });
      }

      req.userEmail = userEmail;
      next();
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token. Please log in again.' });
    }
    return res.status(401).json({ error: 'Authentication failed.' });
  }
}

// Helper to generate a JWT for a given email
function generateToken(email) {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '24h' });
}

module.exports = {
  authenticateUser,
  generateToken
};
