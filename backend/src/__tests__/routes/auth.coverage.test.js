const request = require('supertest');
const express = require('express');
const authRoutes = require('../../routes/auth');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use((err, req, res, next) => {
  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

describe('Auth Routes - Coverage Improvement', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      get: jest.fn(),
      run: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login - Edge Cases', () => {
    test('should reject empty string email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: '' });

      expect(response.status).toBe(400);
    });

    test('should reject email with spaces', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test @example.com' });

      expect(response.status).toBe(400);
    });

    test('should reject email with multiple @ symbols', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@@example.com' });

      expect(response.status).toBe(400);
    });

    test('should accept email with plus addressing', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'test+tag@example.com', created_at: '2024-01-01' });
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test+tag@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('test+tag@example.com');
    });

    test('should accept email with subdomain', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'user@mail.example.com', created_at: '2024-01-01' });
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@mail.example.com' });

      expect(response.status).toBe(200);
    });

    test('should handle null body', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(null);

      expect(response.status).toBe(400);
    });

    test('should reject non-string email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 12345 });

      expect(response.status).toBe(400);
    });

    test('should reject email with only whitespace', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: '   ' });

      expect(response.status).toBe(400);
    });

    test('should include createdAt in response for new user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'brand-new@example.com' });

      expect(response.status).toBe(201);
      expect(response.body.user.createdAt).toBeDefined();
    });

    test('should include createdAt in response for existing user', async () => {
      const timestamp = '2024-06-15T12:00:00.000Z';
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'existing@example.com', created_at: timestamp });
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'existing@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.user.createdAt).toBe(timestamp);
    });

    test('should handle extra fields in request body gracefully', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'test@example.com', created_at: '2024-01-01' });
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', extraField: 'should be ignored' });

      // Joi stripUnknown or allowUnknown behavior
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('GET /api/auth/me - Edge Cases', () => {
    test('should return 400 for invalid email format in header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('x-user-email', 'not-valid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid email format');
    });

    test('should return 401 for empty email header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('x-user-email', '');

      expect(response.status).toBe(401);
    });

    test('should handle user that exists in auth but not in /me query', async () => {
      let callCount = 0;
      mockDb.get.mockImplementation((query, params, callback) => {
        callCount++;
        if (callCount === 1) {
          // Auth middleware check - user exists
          callback(null, { email: 'ghost@example.com' });
        } else {
          // /me endpoint - user somehow not found
          callback(null, null);
        }
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('x-user-email', 'ghost@example.com');

      expect(response.status).toBe(404);
    });

    test('should handle database error in auth middleware for /me', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('DB down'), null);
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('x-user-email', 'test@example.com');

      expect(response.status).toBe(500);
    });

    test('should create new user via auth middleware when accessing /me', async () => {
      let getCallCount = 0;
      mockDb.get.mockImplementation((query, params, callback) => {
        getCallCount++;
        if (getCallCount === 1) {
          // Auth middleware - user doesn't exist
          callback(null, null);
        } else {
          // /me endpoint - user now exists after creation
          callback(null, { email: 'auto-created@example.com', created_at: '2024-01-01' });
        }
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('x-user-email', 'auto-created@example.com');

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('auto-created@example.com');
    });
  });

  describe('POST /api/auth/login - Concurrent User Creation', () => {
    test('should handle rapid successive login requests for same new user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, null);
      });

      const [response1, response2] = await Promise.all([
        request(app).post('/api/auth/login').send({ email: 'concurrent@example.com' }),
        request(app).post('/api/auth/login').send({ email: 'concurrent@example.com' })
      ]);

      // Both should succeed (either creating or finding the user)
      expect([200, 201]).toContain(response1.status);
      expect([200, 201]).toContain(response2.status);
    });
  });
});
