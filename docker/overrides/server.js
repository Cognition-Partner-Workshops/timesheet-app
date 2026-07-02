const path = require('path');
const { createApp, logger } = require('./lib/createApp');
const { initializeDatabase } = require('./database/init');

const helmetConfig = {
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
};

const isProduction = process.env.NODE_ENV === 'production';

const app = createApp({
  helmetConfig,
  corsOrigin: isProduction ? true : (process.env.FRONTEND_URL || 'http://localhost:5173'),
  errorHandlerScope: 'api',
  serveStatic: isProduction ? path.join(__dirname, '..', 'public') : undefined,
});

const PORT = process.env.PORT || 3001;

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
