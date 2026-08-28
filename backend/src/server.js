const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const workEntryRoutes = require('./routes/workEntries');
const reportRoutes = require('./routes/reports');

const { initializeDatabase, getDatabase } = require('./database/init');
const { errorHandler } = require('./middleware/errorHandler');
const { requestId } = require('./middleware/requestId');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Swagger configuration
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Timesheet API',
      version: '2.0.0',
      description: 'Employee time tracking and reporting API with password-based auth and role-based access control.',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        emailHeader: { type: 'apiKey', in: 'header', name: 'x-user-email' },
      },
    },
  },
  apis: ['./src/routes/*.js'],
});

// Request ID tracking
app.use(requestId);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting - general
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Structured request logging via winston
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: Date.now() - start,
      requestId: req.id,
      ip: req.ip,
    });
  });
  next();
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// Enhanced health check
app.get('/health', (req, res) => {
  const db = getDatabase();
  db.get('SELECT 1 AS ok', (err) => {
    const dbStatus = err ? 'unhealthy' : 'healthy';
    const status = err ? 503 : 200;
    res.status(status).json({
      status: err ? 'degraded' : 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      version: '2.0.0',
    });
  });
});

// Readiness probe
app.get('/ready', (req, res) => {
  const db = getDatabase();
  db.get('SELECT 1 AS ok', (err) => {
    if (err) {
      return res.status(503).json({ ready: false });
    }
    res.json({ ready: true });
  });
});

// Routes — auth rate limiter only on mutation endpoints, not GET /me
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
      logger.info(`Server running on port ${PORT}`);
      logger.info(`API docs: http://localhost:${PORT}/api-docs`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
