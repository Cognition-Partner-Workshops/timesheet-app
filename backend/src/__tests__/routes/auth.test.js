const request = require('supertest');
const express = require('express');
const authRoutes = require('../../routes/auth');
const { getDatabase } = require('../../database/init');
const oidc = require('../../middleware/oidc');

jest.mock('../../database/init');
jest.mock('../../middleware/oidc');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
// Add error handler for Joi validation
app.use((err, req, res, next) => {
  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

describe('Auth Routes', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      get: jest.fn(),
      run: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
    oidc.isOidcEnabled.mockReturnValue(false);
    oidc.extractBearerToken.mockReturnValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    test('should login existing user', async () => {
      const existingUser = {
        email: 'existing@example.com',
        created_at: '2024-01-01T00:00:00.000Z'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, existingUser);
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'existing@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.email).toBe('existing@example.com');
    });

    test('should create new user on first login', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null); // User doesn't exist
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'newuser@example.com' });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User created and logged in successfully');
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT INTO users (email) VALUES (?)',
        ['newuser@example.com'],
        expect.any(Function)
      );
    });

    test('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    test('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    test('should handle database error when checking user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error when creating user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Insert failed'));
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'newuser@example.com' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create user' });
    });

    test('should handle unexpected errors in try-catch block', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/auth/me', () => {
    test('should return current user info', async () => {
      const user = {
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00.000Z'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, user);
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('x-user-email', 'test@example.com');

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.createdAt).toBe('2024-01-01T00:00:00.000Z');
    });

    test('should return 401 if no email header provided', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'User email required in x-user-email header' });
    });

    test('should return 404 if user not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT email FROM users WHERE email = ?')) {
          // Auth middleware check
          callback(null, { email: 'test@example.com' });
        } else {
          // /me endpoint check
          callback(null, null);
        }
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('x-user-email', 'test@example.com');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });

    test('should handle database error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT email FROM users WHERE email = ?')) {
          callback(null, { email: 'test@example.com' });
        } else {
          callback(new Error('Database error'), null);
        }
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('x-user-email', 'test@example.com');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/auth/oidc/config', () => {
    test('should return disabled when OIDC is not configured', async () => {
      oidc.isOidcEnabled.mockReturnValue(false);

      const response = await request(app).get('/api/auth/oidc/config');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ enabled: false });
    });

    test('should return OIDC config when enabled', async () => {
      oidc.isOidcEnabled.mockReturnValue(true);
      oidc.getOidcConfig.mockReturnValue({
        issuerUrl: 'https://accounts.google.com',
        audience: 'my-client-id',
        emailClaim: 'email',
        allowedAlgorithms: ['RS256'],
      });

      const response = await request(app).get('/api/auth/oidc/config');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        enabled: true,
        issuerUrl: 'https://accounts.google.com',
        audience: 'my-client-id',
      });
    });

    test('should return null audience when not configured', async () => {
      oidc.isOidcEnabled.mockReturnValue(true);
      oidc.getOidcConfig.mockReturnValue({
        issuerUrl: 'https://example.com',
        audience: undefined,
        emailClaim: 'email',
        allowedAlgorithms: ['RS256'],
      });

      const response = await request(app).get('/api/auth/oidc/config');

      expect(response.status).toBe(200);
      expect(response.body.audience).toBeNull();
    });
  });

  describe('POST /api/auth/token', () => {
    test('should return 400 when OIDC is not enabled', async () => {
      oidc.isOidcEnabled.mockReturnValue(false);

      const response = await request(app)
        .post('/api/auth/token')
        .send({ token: 'some-jwt' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'OIDC is not enabled on this server' });
    });

    test('should return 400 when token is missing', async () => {
      oidc.isOidcEnabled.mockReturnValue(true);

      const response = await request(app)
        .post('/api/auth/token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Token is required' });
    });

    test('should return 401 for invalid token', async () => {
      oidc.isOidcEnabled.mockReturnValue(true);
      oidc.verifyOidcToken.mockRejectedValue(new Error('invalid signature'));

      const response = await request(app)
        .post('/api/auth/token')
        .send({ token: 'bad-jwt' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid or expired token' });
    });

    test('should login existing user with valid token', async () => {
      oidc.isOidcEnabled.mockReturnValue(true);
      oidc.verifyOidcToken.mockResolvedValue({
        email: 'oidc@example.com',
        subject: 'sub-123',
        claims: { iss: 'https://accounts.google.com' },
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'oidc@example.com', created_at: '2024-01-01' });
      });

      const response = await request(app)
        .post('/api/auth/token')
        .send({ token: 'valid-jwt' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.email).toBe('oidc@example.com');
      expect(response.body.oidc.subject).toBe('sub-123');
      expect(response.body.oidc.issuer).toBe('https://accounts.google.com');
    });

    test('should create new user with valid token', async () => {
      oidc.isOidcEnabled.mockReturnValue(true);
      oidc.verifyOidcToken.mockResolvedValue({
        email: 'newoidc@example.com',
        subject: 'sub-456',
        claims: { iss: 'https://accounts.google.com' },
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/auth/token')
        .send({ token: 'valid-jwt' });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User created and logged in successfully');
      expect(response.body.user.email).toBe('newoidc@example.com');
    });

    test('should handle DB error during token login', async () => {
      oidc.isOidcEnabled.mockReturnValue(true);
      oidc.verifyOidcToken.mockResolvedValue({
        email: 'user@example.com',
        subject: 'sub-789',
        claims: { iss: 'https://accounts.google.com' },
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('DB error'), null);
      });

      const response = await request(app)
        .post('/api/auth/token')
        .send({ token: 'valid-jwt' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle DB error when creating user during token login', async () => {
      oidc.isOidcEnabled.mockReturnValue(true);
      oidc.verifyOidcToken.mockResolvedValue({
        email: 'user@example.com',
        subject: 'sub-000',
        claims: { iss: 'https://accounts.google.com' },
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Insert failed'));
      });

      const response = await request(app)
        .post('/api/auth/token')
        .send({ token: 'valid-jwt' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create user' });
    });
  });
});
