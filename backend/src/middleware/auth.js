const { getDatabase } = require('../database/init');
const { isOidcEnabled, extractBearerToken, verifyOidcToken } = require('./oidc');

function ensureUser(email, callback) {
  const db = getDatabase();

  db.get('SELECT email FROM users WHERE email = ?', [email], (err, row) => {
    if (err) return callback(err);

    if (row) return callback(null, email);

    db.run('INSERT INTO users (email) VALUES (?)', [email], (insertErr) => {
      if (insertErr) return callback(insertErr);
      callback(null, email);
    });
  });
}

function authenticateUser(req, res, next) {
  const bearerToken = extractBearerToken(req);

  if (bearerToken && isOidcEnabled()) {
    verifyOidcToken(bearerToken)
      .then(({ email }) => {
        ensureUser(email, (err, userEmail) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }
          req.userEmail = userEmail;
          next();
        });
      })
      .catch((err) => {
        console.error('OIDC token verification failed:', err.message);
        return res.status(401).json({ error: 'Invalid or expired token' });
      });
    return;
  }

  // Fallback: legacy email-header auth (dev / non-OIDC mode)
  const userEmail = req.headers['x-user-email'];

  if (!userEmail) {
    return res.status(401).json({ error: 'User email required in x-user-email header' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  ensureUser(userEmail, (err, email) => {
    if (err) {
      console.error('Database error:', err);
      if (err.message === 'Failed to create user' || err.code === 'SQLITE_CONSTRAINT') {
        return res.status(500).json({ error: 'Failed to create user' });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
    req.userEmail = email;
    next();
  });
}

module.exports = {
  authenticateUser,
  ensureUser,
};
