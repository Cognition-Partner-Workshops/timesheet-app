const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');
const path = require('path');

const logger = require('./logger');
const { register, metricsMiddleware } = require('./metrics');
const { correlationId } = require('../middleware/correlationId');

const authRoutes = require('../routes/auth');
const clientRoutes = require('../routes/clients');
const workEntryRoutes = require('../routes/workEntries');
const reportRoutes = require('../routes/reports');

const { getDatabase } = require('../database/init');
const { errorHandler } = require('../middleware/errorHandler');

function createApp(options = {}) {
  const app = express();

  // Correlation ID — must come before logging
  app.use(correlationId);

  // Structured HTTP request logging
  app.use(pinoHttp({
    logger,
    genReqId: (req) => req.id,
    serializers: {
      req(req) {
        return { method: req.method, url: req.url, requestId: req.id };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }));

  // Security middleware
  const helmetConfig = options.helmetConfig || {};
  app.use(helmet(helmetConfig));

  // CORS
  const corsOrigin = options.corsOrigin || process.env.FRONTEND_URL || 'http://localhost:5173';
  app.use(cors({ origin: corsOrigin, credentials: true }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
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
        const log = req.log || logger;
        log.error({ err }, 'readiness check failed');
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

  // Error handling
  if (options.errorHandlerScope === 'api') {
    app.use('/api', errorHandler);
  } else {
    app.use(errorHandler);
  }

  // Static file serving for production Docker builds
  if (options.serveStatic) {
    const publicPath = path.join(options.serveStatic);
    app.use(express.static(publicPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  } else {
    app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });
  }

  return app;
}

async function startServer(app, options = {}) {
  const { initializeDatabase } = require('../database/init');
  const port = options.port || process.env.PORT || 3001;
  const host = options.host || undefined;
  const extraLogFields = options.extraLogFields || {};

  try {
    await initializeDatabase();
    const listenArgs = host ? [port, host] : [port];
    app.listen(...listenArgs, () => {
      logger.info({ port, ...extraLogFields }, 'server started');
    });
  } catch (error) {
    logger.fatal({ err: error }, 'failed to start server');
    process.exit(1);
  }
}

module.exports = { createApp, startServer, logger };
