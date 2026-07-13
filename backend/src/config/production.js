// Production configuration
// All secrets are read from the environment / secrets manager.
// Never hardcode credentials in this file.

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  database: {
    url: required('DATABASE_URL'),
  },
  sendgrid: {
    apiKey: required('SENDGRID_API_KEY'),
  },
};
