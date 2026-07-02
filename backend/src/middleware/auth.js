const { getDatabase } = require('../database/init');

// In-memory cache of known user emails to avoid a DB query on every request.
// The cache is invalidated when the database instance changes (e.g. reconnect).
let knownUsers = new Set();
let cachedDbRef = null;

// Simple email-based authentication middleware
function authenticateUser(req, res, next) {
  const userEmail = req.headers['x-user-email'];
  
  if (!userEmail) {
    return res.status(401).json({ error: 'User email required in x-user-email header' });
  }

  // Validate email format (requires TLD; character classes avoid backtracking)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+$/;
  if (!emailRegex.test(userEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const db = getDatabase();

  // Invalidate cache when the database instance changes
  if (db !== cachedDbRef) {
    knownUsers = new Set();
    cachedDbRef = db;
  }

  // Fast path: skip DB lookup for users we have already verified
  if (knownUsers.has(userEmail)) {
    req.userEmail = userEmail;
    return next();
  }
  
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
        
        knownUsers.add(userEmail);
        req.userEmail = userEmail;
        next();
      });
    } else {
      knownUsers.add(userEmail);
      req.userEmail = userEmail;
      next();
    }
  });
}

module.exports = {
  authenticateUser
};
