/**
 * @fileoverview Express server entry point for the backend application.
 * This file configures and initializes the Express server with security middleware,
 * request parsing, logging, rate limiting, API routes, error handling, and database initialization.
 * 
 * @requires express - Web application framework
 * @requires cors - Cross-Origin Resource Sharing middleware
 * @requires helmet - Security middleware for setting HTTP headers
 * @requires morgan - HTTP request logger middleware
 * @requires express-rate-limit - Rate limiting middleware to prevent abuse
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Route imports
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const workEntryRoutes = require('./routes/workEntries');
const reportRoutes = require('./routes/reports');

// Database and middleware imports
const { initializeDatabase } = require('./database/init');
const { errorHandler } = require('./middleware/errorHandler');

/**
 * Express application instance
 * @type {express.Application}
 */
const app = express();

/**
 * Server port number
 * Defaults to 3001 if PORT environment variable is not set
 * @type {number}
 * @default 3001
 */
const PORT = process.env.PORT || 3001;

/**
 * ============================================================================
 * SECURITY MIDDLEWARE CONFIGURATION
 * ============================================================================
 */

/**
 * Helmet middleware - Sets various HTTP headers to secure the application
 * 
 * Provides protection against common web vulnerabilities:
 * - X-DNS-Prefetch-Control: Controls browser DNS prefetching
 * - X-Frame-Options: Prevents clickjacking attacks
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - X-XSS-Protection: Enables XSS filter in older browsers
 * - Content-Security-Policy: Controls resources the browser is allowed to load
 * - Strict-Transport-Security: Enforces HTTPS connections
 * 
 * @see {@link https://helmetjs.github.io/|Helmet Documentation}
 */
app.use(helmet());

/**
 * CORS (Cross-Origin Resource Sharing) middleware
 * 
 * Configures which origins can access the API and enables credential sharing.
 * This is essential for allowing the frontend application to communicate with the backend.
 * 
 * Configuration:
 * @property {string} origin - Allowed origin for cross-origin requests
 *   - Defaults to 'http://localhost:5173' (Vite dev server default)
 *   - Can be overridden via FRONTEND_URL environment variable
 * @property {boolean} credentials - Enables cookies and authentication headers in CORS requests
 *   - Set to true to allow session cookies and authorization headers
 * 
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS|CORS Documentation}
 */
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

/**
 * ============================================================================
 * RATE LIMITING CONFIGURATION
 * ============================================================================
 */

/**
 * Rate limiter configuration
 * 
 * Protects the API from abuse by limiting the number of requests from a single IP address.
 * Helps prevent brute force attacks, DDoS attempts, and excessive API usage.
 * 
 * Configuration:
 * @property {number} windowMs - Time window in milliseconds (15 minutes = 900,000ms)
 *   - Defines the duration for which request counts are tracked
 * @property {number} max - Maximum number of requests allowed per IP within the time window
 *   - Set to 100 requests per 15 minutes
 *   - After exceeding this limit, requests will receive a 429 (Too Many Requests) response
 * 
 * @type {rateLimit.RateLimit}
 * @see {@link https://www.npmjs.com/package/express-rate-limit|express-rate-limit Documentation}
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

/**
 * Apply rate limiting to all requests
 * This middleware should be applied early in the middleware chain to protect all routes
 */
app.use(limiter);

/**
 * ============================================================================
 * LOGGING MIDDLEWARE
 * ============================================================================
 */

/**
 * Morgan HTTP request logger middleware
 * 
 * Logs all incoming HTTP requests with detailed information for monitoring and debugging.
 * Uses the 'combined' format which includes:
 * - Remote IP address
 * - Request timestamp
 * - HTTP method and URL
 * - HTTP version
 * - Response status code
 * - Response content length
 * - Referrer
 * - User agent
 * 
 * Format: ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
 * 
 * @see {@link https://www.npmjs.com/package/morgan|Morgan Documentation}
 */
app.use(morgan('combined'));

/**
 * ============================================================================
 * REQUEST BODY PARSING MIDDLEWARE
 * ============================================================================
 */

/**
 * JSON body parser middleware
 * 
 * Parses incoming requests with JSON payloads and makes the data available in req.body.
 * Essential for handling POST, PUT, and PATCH requests with JSON data.
 * 
 * Configuration:
 * @property {string} limit - Maximum request body size (10MB)
 *   - Prevents memory exhaustion from extremely large payloads
 *   - Suitable for most API requests including those with base64 encoded files
 * 
 * @see {@link https://expressjs.com/en/api.html#express.json|express.json Documentation}
 */
app.use(express.json({ limit: '10mb' }));

/**
 * URL-encoded body parser middleware
 * 
 * Parses incoming requests with URL-encoded payloads (typically from HTML forms).
 * Makes the parsed data available in req.body.
 * 
 * Configuration:
 * @property {boolean} extended - Use qs library (true) or querystring library (false)
 *   - Set to true to allow rich objects and arrays to be encoded into URL-encoded format
 *   - Enables parsing of nested objects
 * 
 * @see {@link https://expressjs.com/en/api.html#express.urlencoded|express.urlencoded Documentation}
 */
app.use(express.urlencoded({ extended: true }));

/**
 * ============================================================================
 * HEALTH CHECK ENDPOINT
 * ============================================================================
 */

/**
 * Health check endpoint
 * 
 * Provides a simple endpoint to verify that the server is running and responsive.
 * Useful for monitoring tools, load balancers, and container orchestration systems.
 * 
 * @route GET /health
 * @returns {Object} 200 - Server status and current timestamp
 * @returns {string} 200.status - Always returns 'OK' when server is running
 * @returns {string} 200.timestamp - ISO 8601 formatted timestamp of the request
 * 
 * @example
 * // Response
 * {
 *   "status": "OK",
 *   "timestamp": "2024-01-15T10:30:45.123Z"
 * }
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

/**
 * ============================================================================
 * API ROUTE REGISTRATION
 * ============================================================================
 */

/**
 * Authentication routes
 * Handles user registration, login, logout, and token management
 * @route /api/auth
 * @see {@link ./routes/auth|Auth Routes}
 */
app.use('/api/auth', authRoutes);

/**
 * Client management routes
 * Handles CRUD operations for client records
 * @route /api/clients
 * @see {@link ./routes/clients|Client Routes}
 */
app.use('/api/clients', clientRoutes);

/**
 * Work entry routes
 * Handles CRUD operations for time tracking and work entries
 * @route /api/work-entries
 * @see {@link ./routes/workEntries|Work Entry Routes}
 */
app.use('/api/work-entries', workEntryRoutes);

/**
 * Report generation routes
 * Handles generation and retrieval of various reports
 * @route /api/reports
 * @see {@link ./routes/reports|Report Routes}
 */
app.use('/api/reports', reportRoutes);

/**
 * ============================================================================
 * ERROR HANDLING MIDDLEWARE
 * ============================================================================
 */

/**
 * Global error handler middleware
 * 
 * Catches and processes all errors that occur during request handling.
 * This middleware should be registered after all routes to catch any errors
 * that were not handled by route-specific error handlers.
 * 
 * Features:
 * - Standardizes error response format across the API
 * - Logs error details for debugging
 * - Prevents sensitive error information from leaking to clients
 * - Handles both operational and programming errors
 * 
 * @see {@link ./middleware/errorHandler|Error Handler Middleware}
 */
app.use(errorHandler);

/**
 * 404 Not Found handler
 * 
 * Catches all requests that don't match any defined routes.
 * This middleware must be registered last (after all other routes and middleware)
 * to act as a catch-all for undefined endpoints.
 * 
 * @route * (all unmatched routes)
 * @returns {Object} 404 - Error response indicating route was not found
 * @returns {string} 404.error - Error message
 * 
 * @example
 * // Response for GET /api/nonexistent
 * {
 *   "error": "Route not found"
 * }
 */
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/**
 * ============================================================================
 * SERVER INITIALIZATION AND STARTUP
 * ============================================================================
 */

/**
 * Initializes the database and starts the Express server
 * 
 * This async function performs the following startup sequence:
 * 1. Initializes the database connection and schema
 * 2. Starts the Express server on the configured port
 * 3. Logs startup information to the console
 * 4. Handles any startup errors gracefully
 * 
 * Error Handling:
 * - If database initialization fails, the server will not start
 * - If server startup fails, the process exits with code 1
 * - All errors are logged to the console for debugging
 * 
 * @async
 * @function startServer
 * @returns {Promise<void>} Resolves when server is successfully started
 * @throws {Error} If database initialization or server startup fails
 * 
 * @example
 * // Successful startup logs:
 * // Server running on port 3001
 * // Health check: http://localhost:3001/health
 * 
 * @see {@link ./database/init|Database Initialization}
 */
async function startServer() {
  try {
    // Initialize database connection and schema
    await initializeDatabase();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    // Log error and exit process if startup fails
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Execute server startup
startServer();

/**
 * Export the Express application instance
 * 
 * Exported for testing purposes and to allow the app to be imported
 * and used in other modules without starting the server.
 * 
 * @type {express.Application}
 */
module.exports = app;
