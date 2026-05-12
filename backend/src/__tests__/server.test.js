// Use process.pid for deterministic port to avoid EADDRINUSE conflicts
process.env.PORT = String(30000 + (process.pid % 10000));

const request = require('supertest');

const mockDb = {
  all: jest.fn((q, p, cb) => cb(null, [])),
  get: jest.fn((q, p, cb) => cb(null, { email: 'test@example.com' })),
  run: jest.fn((q, pOrCb, cb) => {
    const fn = typeof pOrCb === 'function' ? pOrCb : cb;
    if (typeof fn === 'function') fn(null);
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

function resetDbMocks() {
  mockDb.all.mockImplementation((q, p, cb) => cb(null, []));
  mockDb.get.mockImplementation((q, p, cb) => cb(null, { email: 'test@example.com' }));
  mockDb.run.mockImplementation((q, pOrCb, cb) => {
    const fn = typeof pOrCb === 'function' ? pOrCb : cb;
    if (typeof fn === 'function') fn(null);
  });
}

function stubAuthUser() {
  mockDb.get.mockImplementation((q, p, cb) => {
    cb(null, { email: 'test@example.com', created_at: '2024-01-01' });
  });
}

describe('Server', () => {
  afterEach(() => {
    jest.clearAllMocks();
    resetDbMocks();
  });

  describe('GET /health', () => {
    test('should return 200 with status OK and valid timestamp', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      const ts = new Date(response.body.timestamp);
      expect(ts.toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('404 handler', () => {
    test.each([
      ['GET', 'get'],
      ['POST', 'post'],
      ['PUT', 'put'],
      ['DELETE', 'delete']
    ])('should return 404 for unknown %s routes', async (label, method) => {
      const req = request(app)[method]('/api/nonexistent');
      if (method === 'post' || method === 'put') req.send({ data: 'test' });
      const response = await req;

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Route not found' });
    });
  });

  describe('Middleware', () => {
    test('should accept JSON body and process auth login', async () => {
      stubAuthUser();

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
      stubAuthUser();
      const response = await request(app).post('/api/auth/login').send({ email: 'test@example.com' });
      expect(response.status).not.toBe(404);
    });

    test.each([
      ['/api/clients'],
      ['/api/work-entries'],
      ['/api/reports/client/1']
    ])('should mount route at %s', async (path) => {
      const response = await request(app).get(path).set('x-user-email', 'test@example.com');
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
    test('should handle Joi validation errors', async () => {
      const response = await request(app).post('/api/auth/login').send({ email: 'not-valid' });
      expect(response.status).toBe(400);
    });
  });
});
