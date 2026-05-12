const { setupTestApp } = require('../helpers/test-server');
const { TestApiClient } = require('../helpers/api-client');
const { users } = require('../fixtures/test-data');

describe('Auth API', () => {
  let app;
  let api;

  beforeAll(async () => {
    app = await setupTestApp();
    api = new TestApiClient(app, users.primary.email);
  });

  describe('POST /api/auth/login', () => {
    it('should register and login a new user', async () => {
      const res = await api.login(users.primary.email);

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(users.primary.email);
      expect(res.body.message).toMatch(/created/i);
    });

    it('should login an existing user', async () => {
      const res = await api.login(users.primary.email);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(users.primary.email);
      expect(res.body.message).toBe('Login successful');
    });

    it('should reject invalid email format', async () => {
      const res = await api.login('not-an-email');
      expect(res.status).toBe(400);
    });

    it('should reject missing email', async () => {
      const request = require('supertest');
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return the authenticated user', async () => {
      const res = await api.getMe();

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(users.primary.email);
    });

    it('should return 401 without auth header', async () => {
      const request = require('supertest');
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid email in header', async () => {
      const request = require('supertest');
      const res = await request(app)
        .get('/api/auth/me')
        .set('x-user-email', 'bad-email');
      expect(res.status).toBe(400);
    });
  });
});
