const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');

function authenticateUser(req, res, next) {
  const token = req.cookies && req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDatabase();

    db.get('SELECT email FROM users WHERE email = ?', [decoded.email], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!row) {
        return res.status(401).json({ error: 'User not found' });
      }

      req.userEmail = decoded.email;
      next();
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = {
  authenticateUser
};
