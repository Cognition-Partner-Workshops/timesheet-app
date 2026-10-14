const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'dev-fallback-secret';
}

// JWT-based authentication middleware
function authenticateUser(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const userEmail = decoded.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const db = getDatabase();

    // Verify user still exists in database
    db.get('SELECT email FROM users WHERE email = ?', [userEmail], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!row) {
        return res.status(401).json({ error: 'User not found' });
      }

      req.userEmail = userEmail;
      next();
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = {
  authenticateUser,
  getJwtSecret
};
