const request = require('supertest');

jest.mock('../database/init', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  getDatabase: jest.fn().mockReturnValue({
    all: jest.fn(),
    get: jest.fn((query, params, cb) => {
      if (typeof cb === 'function') cb(null, null);
    }),
    run: jest.fn((query, params, cb) => {
      const callback = typeof params === 'function' ? params : cb;
      if (typeof callback === 'function') callback.call({ lastID: 1, changes: 1 }, null);
    }),
    serialize: jest.fn((cb) => cb()),
    close: jest.fn((cb) => cb && cb(null))
  })
}));

let consoleSpy;
let consoleErrorSpy;

beforeAll(() => {
  consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
});

afterAll((done) => {
  consoleSpy.mockRestore();
  consoleErrorSpy.mockRestore();
  if (app.server) {
    app.server.close(done);
  } else {
    done();
  }
});

const app = require('../server');

describe('Server', () => {
  test('GET /health should return 200 with status OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.timestamp).toBeDefined();
  });

  test('GET /nonexistent should return 404', async () => {
    const res = await request(app).get('/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Route not found' });
  });

  test('should include security headers from helmet', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('should include CORS headers', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  test('should parse JSON bodies', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com' })
      .set('Content-Type', 'application/json');
    expect(res.status).not.toBe(415);
  });
});
