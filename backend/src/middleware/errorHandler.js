const logger = require('../logger');

function errorHandler(err, req, res, next) {
  const requestId = req.id;

  console.error('Error:', err);

  // Joi validation errors
  if (err.isJoi) {
    logger.warn('Validation error', { requestId, details: err.details });
    return res.status(400).json({
      error: 'Validation error',
      details: err.details.map(detail => detail.message)
    });
  }

  // SQLite errors
  if (err.code && err.code.startsWith('SQLITE_')) {
    logger.error('Database error', { requestId, code: err.code, message: err.message });
    return res.status(500).json({
      error: 'Database error',
      message: 'An error occurred while processing your request'
    });
  }

  // Default error
  logger.error('Unhandled error', { requestId, error: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
}

module.exports = {
  errorHandler
};
