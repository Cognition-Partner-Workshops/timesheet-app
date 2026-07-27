// Production configuration
// All sensitive values must be provided via environment variables / a secrets manager.

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: '24h',
  },
  database: {
    url: requireEnv('DATABASE_URL'),
  },
  sendgrid: {
    apiKey: requireEnv('SENDGRID_API_KEY'),
  },
};
