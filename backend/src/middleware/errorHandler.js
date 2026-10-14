function errorHandler(err, req, res, next) {
  // Log full error details server-side for debugging (never sent to client)
  console.error('Error:', err.message || err);

  // Joi validation errors — safe to expose field-level details
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.details.map(detail => detail.message)
    });
  }

  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'Forbidden'
    });
  }

  // SQLite errors — generic message, never expose internal details
  if (err.code && err.code.startsWith('SQLITE_')) {
    return res.status(500).json({
      error: 'An error occurred while processing your request'
    });
  }

  // Default error — only expose message for known client errors (4xx)
  const status = err.status || 500;
  const isClientError = status >= 400 && status < 500;
  res.status(status).json({
    error: isClientError ? (err.message || 'Bad request') : 'Internal server error'
  });
}

module.exports = {
  errorHandler
};
