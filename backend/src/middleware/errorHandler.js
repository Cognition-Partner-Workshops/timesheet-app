const { getLog } = require('../lib/routeHelpers');

function errorHandler(err, req, res, next) {
  const requestId = req.id;
  const log = getLog(req);

  // Joi validation errors
  if (err.isJoi) {
    log.warn({ err, requestId, validationDetails: err.details }, 'validation error');
    return res.status(400).json({
      error: 'Validation error',
      details: err.details.map(detail => detail.message)
    });
  }

  // SQLite errors
  if (err.code && err.code.startsWith('SQLITE_')) {
    log.error({ err, requestId, sqliteCode: err.code }, 'database error');
    return res.status(500).json({
      error: 'Database error',
      message: 'An error occurred while processing your request'
    });
  }

  // Default error — structured with stack trace
  const status = err.status || 500;
  console.error('Error:', err);
  getLog(req).error({
    err,
    requestId,
    statusCode: status,
    stack: err.stack,
  }, err.message || 'unhandled error');

  res.status(status).json({
    error: err.message || 'Internal server error'
  });
}

module.exports = {
  errorHandler
};
