const JWT_EXPIRY = '24h';

let cachedSecret = null;

function getJwtSecret() {
  if (cachedSecret) return cachedSecret;
  cachedSecret = process.env.JWT_SECRET;
  if (!cachedSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production');
  }
  if (!cachedSecret) {
    cachedSecret = require('crypto').randomBytes(32).toString('hex');
  }
  return cachedSecret;
}

module.exports = {
  getJwtSecret,
  JWT_EXPIRY
};
