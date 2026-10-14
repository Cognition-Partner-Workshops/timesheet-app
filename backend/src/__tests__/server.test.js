const request = require('supertest');

jest.mock('../database/init', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  getDatabase: jest.fn().mockReturnValue({
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn()
  })
}));

const app = require('../server');

describe('Server', () => {
  describe('GET /health', () => {
    test('should return health check with OK status', async () => {
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

    test('should return 404 for unknown nested routes', async () => {
      const response = await request(app).get('/some/deep/path');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Route not found' });
    });
  });

  describe('Middleware', () => {
    test('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('should accept JSON content type', async () => {
      const response = await request(app)
        .get('/health')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
    });
  });
});
