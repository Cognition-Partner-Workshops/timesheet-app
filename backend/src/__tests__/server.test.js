// Use random port to avoid EADDRINUSE conflicts
process.env.PORT = String(30000 + Math.floor(Math.random() * 10000));

const request = require('supertest');

const mockDb = {
  all: jest.fn((query, params, callback) => callback(null, [])),
  get: jest.fn((query, params, callback) => callback(null, { email: 'test@example.com' })),
  run: jest.fn((query, paramsOrCb, callback) => {
    const cb = typeof paramsOrCb === 'function' ? paramsOrCb : callback;
    if (typeof cb === 'function') cb(null);
  }),
  serialize: jest.fn((cb) => cb()),
  close: jest.fn((cb) => cb && cb(null))
};

jest.mock('../database/init', () => ({
  getDatabase: jest.fn(() => mockDb),
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  closeDatabase: jest.fn().mockResolvedValue(undefined)
}));

const app = require('../server');

describe('Server', () => {
  afterEach(() => {
    jest.clearAllMocks();
    // Restore default mock implementations
    mockDb.all.mockImplementation((query, params, callback) => callback(null, []));
    mockDb.get.mockImplementation((query, params, callback) => callback(null, { email: 'test@example.com' }));
    mockDb.run.mockImplementation((query, paramsOrCb, callback) => {
      const cb = typeof paramsOrCb === 'function' ? paramsOrCb : callback;
      if (typeof cb === 'function') cb(null);
    });
  });

  describe('GET /health', () => {
    test('should return 200 with status OK', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.timestamp).toBeDefined();
    });

    test('should return valid ISO timestamp', async () => {
      const response = await request(app).get('/health');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('404 handler', () => {
    test('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Route not found' });
    });

    test('should return 404 for unknown POST routes', async () => {
      const response = await request(app)
        .post('/api/nonexistent')
        .send({ data: 'test' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Route not found' });
    });

    test('should return 404 for unknown PUT routes', async () => {
      const response = await request(app)
        .put('/api/nonexistent')
        .send({ data: 'test' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Route not found' });
    });

    test('should return 404 for unknown DELETE routes', async () => {
      const response = await request(app).delete('/api/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Route not found' });
    });
  });

  describe('Middleware', () => {
    test('should accept JSON body and process auth login', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'test@example.com', created_at: '2024-01-01' });
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' })
        .set('Content-Type', 'application/json');

      expect(response.status).not.toBe(415);
      expect(response.status).not.toBe(404);
    });

    test('should include security headers from helmet', async () => {
      const response = await request(app).get('/health');

      expect(response.headers).toHaveProperty('x-content-type-options');
    });

    test('should handle CORS headers', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:5173');

      expect(response.status).not.toBe(403);
    });
  });

  describe('Route mounting', () => {
    test('should mount auth routes at /api/auth', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'test@example.com', created_at: '2024-01-01' });
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).not.toBe(404);
    });

    test('should mount client routes at /api/clients', async () => {
      const response = await request(app)
        .get('/api/clients')
        .set('x-user-email', 'test@example.com');

      expect(response.status).not.toBe(404);
    });

    test('should mount work entry routes at /api/work-entries', async () => {
      const response = await request(app)
        .get('/api/work-entries')
        .set('x-user-email', 'test@example.com');

      expect(response.status).not.toBe(404);
    });

    test('should mount report routes at /api/reports', async () => {
      const response = await request(app)
        .get('/api/reports/client/1')
        .set('x-user-email', 'test@example.com');

      expect(response.status).not.toBe(404);
    });
  });

  describe('App export', () => {
    test('should export express app', () => {
      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });
  });

  describe('Error handler', () => {
    test('should handle Joi validation errors through error handler', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-valid' });

      expect(response.status).toBe(400);
    });
  });
});
