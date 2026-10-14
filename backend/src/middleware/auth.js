const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');

const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';

// JWT-based authentication middleware
// Accepts token via Authorization header (Bearer <token>) or falls back to x-user-email for backward compatibility
function authenticateUser(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // JWT token authentication (preferred)
    const token = authHeader.slice(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userEmail = decoded.email;
      
      if (!userEmail) {
        return res.status(401).json({ error: 'Invalid token: missing email claim' });
      }
      
      const db = getDatabase();
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
      return res.status(401).json({ error: 'Invalid token' });
    }
  } else {
    // Fallback: x-user-email header (backward compatibility, to be removed in future)
    const userEmail = req.headers['x-user-email'];
    
    if (!userEmail) {
      return res.status(401).json({ error: 'Authentication required. Provide a Bearer token in the Authorization header.' });
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
}

module.exports = {
  authenticateUser
};
