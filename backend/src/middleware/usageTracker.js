const { getDatabase } = require('../database/init');

const ROUTE_MAP = [
  { pattern: /^\/api\/auth\/login$/, family: 'authentication', action: 'login' },
  { pattern: /^\/api\/auth\/me$/, family: 'authentication', action: 'view_profile' },

  { pattern: /^\/api\/clients$/, method: 'GET', family: 'client_management', action: 'list' },
  { pattern: /^\/api\/clients$/, method: 'POST', family: 'client_management', action: 'create' },
  { pattern: /^\/api\/clients$/, method: 'DELETE', family: 'client_management', action: 'delete_all' },
  { pattern: /^\/api\/clients\/\d+$/, method: 'GET', family: 'client_management', action: 'view' },
  { pattern: /^\/api\/clients\/\d+$/, method: 'PUT', family: 'client_management', action: 'update' },
  { pattern: /^\/api\/clients\/\d+$/, method: 'DELETE', family: 'client_management', action: 'delete' },

  { pattern: /^\/api\/work-entries$/, method: 'GET', family: 'time_tracking', action: 'list' },
  { pattern: /^\/api\/work-entries$/, method: 'POST', family: 'time_tracking', action: 'create' },
  { pattern: /^\/api\/work-entries\/\d+$/, method: 'GET', family: 'time_tracking', action: 'view' },
  { pattern: /^\/api\/work-entries\/\d+$/, method: 'PUT', family: 'time_tracking', action: 'update' },
  { pattern: /^\/api\/work-entries\/\d+$/, method: 'DELETE', family: 'time_tracking', action: 'delete' },

  { pattern: /^\/api\/reports\/client\/\d+$/, family: 'reporting', action: 'view_report' },
  { pattern: /^\/api\/reports\/export\/csv\/\d+$/, family: 'reporting', action: 'export_csv' },
  { pattern: /^\/api\/reports\/export\/pdf\/\d+$/, family: 'reporting', action: 'export_pdf' },
];

function classifyRoute(method, path) {
  for (const route of ROUTE_MAP) {
    if (route.pattern.test(path)) {
      if (!route.method || route.method === method) {
        return { family: route.family, action: route.action };
      }
    }
  }
  return null;
}

function usageTracker(req, res, next) {
  const originalEnd = res.end;

  res.end = function (...args) {
    res.end = originalEnd;
    res.end(...args);

    if (res.statusCode >= 400) return;

    const userEmail = req.headers['x-user-email'] || req.userEmail;
    if (!userEmail) return;

    const classification = classifyRoute(req.method, req.originalUrl.split('?')[0]);
    if (!classification) return;

    const db = getDatabase();
    db.run(
      'INSERT INTO feature_usage (user_email, feature_family, action, endpoint) VALUES (?, ?, ?, ?)',
      [userEmail, classification.family, classification.action, `${req.method} ${req.originalUrl.split('?')[0]}`],
      (err) => {
        if (err) {
          console.error('Failed to log feature usage:', err);
        }
      }
    );
  };

  next();
}

module.exports = { usageTracker, classifyRoute };
