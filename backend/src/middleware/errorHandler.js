function errorHandler(err, req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Log full error details server-side (but avoid leaking to client)
  if (!isProduction) {
    console.error('Error:', err);
  } else {
    // In production, log a sanitized version without stack traces
    console.error('Error:', err.message || 'Unknown error');
  }

  // Joi validation errors - safe to return field-level details
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.details.map(detail => detail.message)
    });
  }

  // SQLite errors - never expose database details
  if (err.code && err.code.startsWith('SQLITE_')) {
    return res.status(500).json({
      error: 'An error occurred while processing your request.'
    });
  }

  // Default error - only expose message in development
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    error: isProduction && statusCode === 500
      ? 'An internal error occurred. Please try again later.'
      : err.message || 'Internal server error'
  });
}

module.exports = {
  errorHandler
};
