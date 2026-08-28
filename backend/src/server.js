const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const workEntryRoutes = require('./routes/workEntries');
const reportRoutes = require('./routes/reports');

const { initializeDatabase } = require('./database/init');
const { errorHandler } = require('./middleware/errorHandler');

// JWT Secret Hardening (Fix #2)
const KNOWN_WEAK_SECRETS = [
  'your-super-secret-jwt-key-change-this-in-production-min-32-chars',
  'your-secure-secret-key-change-this',
  'secret',
  'jwt-secret',
  'changeme',
  'dev-fallback-secret'
];

function validateJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!jwtSecret) {
      console.error('FATAL: JWT_SECRET environment variable is required in production');
      process.exit(1);
    }
    if (KNOWN_WEAK_SECRETS.includes(jwtSecret)) {
      console.error('FATAL: JWT_SECRET is set to a known default value. Use a strong, unique secret in production');
      process.exit(1);
    }
    if (jwtSecret.length < 32) {
      console.error('FATAL: JWT_SECRET must be at least 32 characters long in production');
      process.exit(1);
    }
  } else {
    if (!jwtSecret || KNOWN_WEAK_SECRETS.includes(jwtSecret)) {
      const generatedSecret = crypto.randomBytes(64).toString('hex');
      process.env.JWT_SECRET = generatedSecret;
      console.warn('WARNING: Using auto-generated JWT secret for development. Set JWT_SECRET in .env for persistent sessions.');
    }
  }
}

validateJwtSecret();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// General rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes - auth rate limiting applied per-route inside auth.js for login/register only
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/work-entries', workEntryRoutes);
app.use('/api/reports', reportRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
