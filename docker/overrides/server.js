const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');

const logger = require('./lib/logger');
const { register, metricsMiddleware } = require('./lib/metrics');
const { correlationId } = require('./middleware/correlationId');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const workEntryRoutes = require('./routes/workEntries');
const reportRoutes = require('./routes/reports');

const { initializeDatabase, getDatabase } = require('./database/init');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Correlation ID — must come before logging
app.use(correlationId);

// Structured HTTP request logging
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.id,
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        requestId: req.id,
      };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
  },
}));

// Security middleware with CSP configured for React SPA
// Note: HSTS and upgrade-insecure-requests disabled since we serve HTTP without SSL
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
    },
    useDefaults: false,
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  strictTransportSecurity: false,
}));

// CORS configuration - in production, same origin so allow all
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : (process.env.FRONTEND_URL || 'http://localhost:5173'),
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Prometheus metrics middleware
app.use(metricsMiddleware);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Liveness probe
app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness probe
app.get('/health/ready', (req, res) => {
  const db = getDatabase();
  db.get('SELECT 1', (err) => {
    if (err) {
      req.log.error({ err }, 'readiness check failed');
      return res.status(503).json({ status: 'unavailable', reason: 'database unreachable' });
    }
    res.status(200).json({ status: 'ok' });
  });
});

// Legacy health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/work-entries', workEntryRoutes);
app.use('/api/reports', reportRoutes);

// Error handling for API routes
app.use('/api', errorHandler);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));
  
  // Handle React routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
} else {
  // 404 handler for development
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
}

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'server started');
    });
  } catch (error) {
    logger.fatal({ err: error }, 'failed to start server');
    process.exit(1);
  }
}

startServer();

module.exports = app;
