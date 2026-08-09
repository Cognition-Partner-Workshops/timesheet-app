const { getDatabase } = require('../database/init');

const MAX_KNOWN_USERS = 1000;
const knownUsersByDatabase = new WeakMap();

function getKnownUsers(db) {
  let knownUsers = knownUsersByDatabase.get(db);
  if (!knownUsers) {
    knownUsers = new Map();
    knownUsersByDatabase.set(db, knownUsers);
  }
  return knownUsers;
}

function rememberUser(db, email) {
  const knownUsers = getKnownUsers(db);
  if (knownUsers.has(email)) {
    knownUsers.delete(email);
  }
  knownUsers.set(email, true);
  if (knownUsers.size > MAX_KNOWN_USERS) {
    knownUsers.delete(knownUsers.keys().next().value);
  }
}

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
  const knownUsers = getKnownUsers(db);
  if (process.env.AUTH_CACHE_ENABLED !== '0' && knownUsers.has(userEmail)) {
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
        
        req.userEmail = userEmail;
        next();
      });
    } else {
      if (process.env.AUTH_CACHE_ENABLED !== '0') {
        rememberUser(db, userEmail);
      }
      req.userEmail = userEmail;
      next();
    }
  });
}

module.exports = {
  authenticateUser
};
