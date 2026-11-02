// Production configuration
// All secrets are read from environment variables (or a secrets manager
// that injects them as env vars). No secret values may be hardcoded here.

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  jwt: {
    get secret() {
      return requireEnv('JWT_SECRET');
    },
    expiresIn: '24h',
  },
  database: {
    get url() {
      return requireEnv('DATABASE_URL');
    },
  },
  sendgrid: {
    get apiKey() {
      return requireEnv('SENDGRID_API_KEY');
    },
  },
};
