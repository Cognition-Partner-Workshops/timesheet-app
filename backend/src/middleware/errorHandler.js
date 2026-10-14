function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  const isProduction = process.env.NODE_ENV === 'production';

  // Joi validation errors - safe to expose validation details
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.details.map(detail => detail.message)
    });
  }

  // SQLite errors - never expose database details
  if (err.code && err.code.startsWith('SQLITE_')) {
    return res.status(500).json({
      error: 'Database error',
      message: 'An error occurred while processing your request'
    });
  }

  // Default error - hide internal details in production
  const statusCode = err.status || 500;
  const responseBody = {
    error: isProduction && statusCode >= 500
      ? 'Internal server error'
      : err.message || 'Internal server error'
  };

  res.status(statusCode).json(responseBody);
}

module.exports = {
  errorHandler
};
