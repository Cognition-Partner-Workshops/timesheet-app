const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.SECURITY_LOG_DIR || path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'security.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function logSecurityEvent(event) {
  const entry = {
    timestamp: new Date().toISOString(),
    ...event
  };

  const line = JSON.stringify(entry) + '\n';

  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) {
      console.error('Failed to write security log:', err);
    }
  });

  // Also log to console for visibility
  console.warn('[SECURITY]', JSON.stringify(entry));
}

function logFailedLogin(email, ip, reason) {
  logSecurityEvent({
    type: 'FAILED_LOGIN',
    email,
    ip,
    reason
  });
}

function logUnauthorizedAccess(ip, requestPath, reason) {
  logSecurityEvent({
    type: 'UNAUTHORIZED_ACCESS',
    ip,
    path: requestPath,
    reason
  });
}

function logBulkDelete(email, ip, resourceType, count) {
  logSecurityEvent({
    type: 'BULK_DELETE',
    email,
    ip,
    resourceType,
    deletedCount: count
  });
}

function logRateLimitHit(ip, requestPath) {
  logSecurityEvent({
    type: 'RATE_LIMIT_HIT',
    ip,
    path: requestPath
  });
}

module.exports = {
  logSecurityEvent,
  logFailedLogin,
  logUnauthorizedAccess,
  logBulkDelete,
  logRateLimitHit
};
