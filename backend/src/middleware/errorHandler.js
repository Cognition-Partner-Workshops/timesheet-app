/**
 * Express error handler. Maps Joi validation errors to 400, SQLite errors to
 * a generic 500 (never leaking SQL details), and everything else to
 * `err.status` or 500. Must be registered after all routes.
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Joi validation errors
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.details.map(detail => detail.message)
    });
  }

  // SQLite errors (err.code may be a non-string for other error types, e.g. system errors)
  if (typeof err.code === 'string' && err.code.startsWith('SQLITE_')) {
    return res.status(500).json({
      error: 'Database error',
      message: 'An error occurred while processing your request'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
}

module.exports = {
  errorHandler
};
