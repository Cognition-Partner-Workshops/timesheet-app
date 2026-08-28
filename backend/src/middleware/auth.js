const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');

// JWT-based authentication middleware
function authenticateUser(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    if (!email) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const db = getDatabase();

    // Verify user exists in the database
    db.get('SELECT email FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!row) {
        return res.status(401).json({ error: 'User not found' });
      }

      req.userEmail = email;
      next();
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = {
  authenticateUser
};
