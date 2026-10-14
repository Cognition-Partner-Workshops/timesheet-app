const path = require('path');
const { createApp, startServer } = require('./lib/createApp');

const isProduction = process.env.NODE_ENV === 'production';

const app = createApp({
  helmetConfig: {
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
  },
  corsOrigin: isProduction ? true : (process.env.FRONTEND_URL || 'http://localhost:5173'),
  errorHandlerScope: 'api',
  serveStatic: isProduction ? path.join(__dirname, '..', 'public') : undefined,
});

startServer(app, {
  host: '0.0.0.0',
  extraLogFields: { env: process.env.NODE_ENV || 'development' },
});

module.exports = app;
