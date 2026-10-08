const EMAIL_PATTERN = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

function redactPII(text) {
  if (typeof text !== 'string') return text;
  return text.replace(EMAIL_PATTERN, '$1***@$2');
}

// Only allow-listed, redacted fields are logged; never the raw error object,
// which can carry request bodies (Joi `_original`), headers or SQL params.
function sanitizeError(err) {
  if (!err || typeof err !== 'object') {
    return { message: redactPII(String(err)) };
  }
  const safe = {};
  if (err.name) safe.name = err.name;
  if (err.code) safe.code = err.code;
  if (err.status) safe.status = err.status;
  if (err.message) safe.message = redactPII(err.message);
  return safe;
}

function logError(context, err) {
  console.error(context, sanitizeError(err));
}

function anonymizeIp(ip) {
  if (!ip) return '-';
  const v4 = ip.replace(/^::ffff:/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) {
    return v4.replace(/\.\d{1,3}$/, '.0');
  }
  if (ip.includes(':')) {
    return ip.split(':').slice(0, 3).join(':') + '::';
  }
  return '-';
}

// Morgan format that replaces the client IP with a truncated one and omits
// referrer and user-agent (combined format logs all three).
function registerPrivacyLogFormat(morgan) {
  morgan.token('anon-ip', (req) => anonymizeIp(req.ip || (req.socket && req.socket.remoteAddress)));
  return ':anon-ip - [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms';
}

module.exports = {
  redactPII,
  sanitizeError,
  logError,
  anonymizeIp,
  registerPrivacyLogFormat
};
