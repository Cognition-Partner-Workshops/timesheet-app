const path = require('path');

// Load dotenv as early as possible
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // CORS
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',

  // Database
  databaseUrl: process.env.DATABASE_URL || ':memory:',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'combined',

  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,

  // Body parser
  bodyLimit: process.env.BODY_LIMIT || '10mb',
};

module.exports = config;
