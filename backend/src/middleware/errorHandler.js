const { logError } = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logError('Error:', err);

  // Joi validation errors
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.details.map(detail => detail.message)
    });
  }

  // SQLite errors
  if (err.code && err.code.startsWith('SQLITE_')) {
    return res.status(500).json({
      error: 'Database error',
      message: 'An error occurred while processing your request'
    });
  }

  // Default error: never echo internal (5xx) messages, which may contain PII
  const status = err.status || 500;
  res.status(status).json({
    error: status < 500 && err.message ? err.message : 'Internal server error'
  });
}

module.exports = {
  errorHandler
};
