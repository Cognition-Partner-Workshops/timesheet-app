const { getDatabase } = require('../database/init');

// Simple email-based authentication middleware
function authenticateUser(req, res, next) {
  const userEmail = req.headers['x-user-email'];
  
  if (!userEmail) {
    return res.status(401).json({ error: 'User email required in x-user-email header' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const db = getDatabase();
  
  // Ensure user exists (INSERT OR IGNORE is idempotent and race-condition safe)
  db.run('INSERT OR IGNORE INTO users (email) VALUES (?)', [userEmail], (err) => {
    if (err) {
      console.error('Error ensuring user exists:', err);
      return res.status(500).json({ error: 'Failed to authenticate user' });
    }
    
    req.userEmail = userEmail;
    next();
  });
}

module.exports = {
  authenticateUser
};
