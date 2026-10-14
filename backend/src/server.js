const crypto = require('crypto');
const express = require('express');
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

// Validate JWT_SECRET at startup
const WEAK_SECRETS = [
  'your-super-secret-jwt-key-change-this-in-production-min-32-chars',
  'your-secure-secret-key-change-this',
  'secret',
  'jwt-secret',
  'change-me',
  'development-only-secret',
];

function validateJwtSecret() {
  let jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret || WEAK_SECRETS.includes(jwtSecret)) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        'SECURITY ERROR: JWT_SECRET is missing or uses a known weak default. ' +
        'Set a strong, unique JWT_SECRET (min 32 characters) in your environment variables.'
      );
      process.exit(1);
    } else {
      // Generate a random secret for development and warn
      jwtSecret = crypto.randomBytes(64).toString('hex');
      process.env.JWT_SECRET = jwtSecret;
      console.warn(
        'WARNING: JWT_SECRET was missing or weak. A random secret has been generated for this session. ' +
        'This means tokens will be invalidated on server restart. ' +
        'Set a strong JWT_SECRET in your .env file for persistent sessions.'
      );
    }
  } else if (jwtSecret.length < 32) {
    console.warn(
      'WARNING: JWT_SECRET is shorter than 32 characters. ' +
      'Use a longer secret for better security.'
    );
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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// Body parsing - limit to 1MB to prevent DoS via large payloads
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
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
