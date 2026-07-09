// Production configuration
// All secrets are read from environment variables / a secrets manager.
// Never commit real secret values to source control.

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'Set it in the environment or your secrets manager before starting the app.'
    );
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
