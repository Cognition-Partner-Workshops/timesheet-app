const { getDatabase } = require('../database/init');

// Email-based authentication middleware with input sanitization
function authenticateUser(req, res, next) {
  const rawEmail = req.headers['x-user-email'];
  
  if (!rawEmail) {
    return res.status(401).json({ error: 'User email required in x-user-email header' });
  }

  // Sanitize: trim whitespace, lowercase, enforce max length
  const userEmail = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

  if (userEmail.length === 0 || userEmail.length > 254) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const db = getDatabase();
  
  // Check if user exists, create if not
  db.get('SELECT email FROM users WHERE email = ?', [userEmail], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!row) {
      // Create new user
      db.run('INSERT INTO users (email) VALUES (?)', [userEmail], (err) => {
        if (err) {
          console.error('Error creating user:', err);
          return res.status(500).json({ error: 'Failed to create user' });
        }
        
        req.userEmail = userEmail;
        next();
      });
    } else {
      req.userEmail = userEmail;
      next();
    }
  });
}

module.exports = {
  authenticateUser
};
