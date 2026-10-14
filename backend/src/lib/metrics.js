const client = require('prom-client');

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpErrorCounter = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP error responses (4xx and 5xx)',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

function normalizeRoute(req) {
  if (req.route && req.route.path) {
    return req.baseUrl + req.route.path;
  }
  // Fallback: collapse numeric path segments to :id
  return req.path.replace(/\/\d+/g, '/:id');
}

function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics') {
    return next();
  }

  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    const route = normalizeRoute(req);
    const labels = {
      method: req.method,
      route: route,
      status_code: res.statusCode,
    };

    httpRequestCounter.inc(labels);
    end(labels);

    if (res.statusCode >= 400) {
      httpErrorCounter.inc(labels);
    }
  });

  next();
}

module.exports = { register, metricsMiddleware };
