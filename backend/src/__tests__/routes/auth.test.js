const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const authRoutes = require('../../routes/auth');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');
jest.mock('bcrypt');

const JWT_SECRET = 'test-secret-key';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use((err, req, res, next) => {
  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET);
}

describe('Auth Routes', () => {
  let mockDb;
  const originalEnv = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    mockDb = {
      get: jest.fn(),
      run: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalEnv;
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      bcrypt.hash.mockResolvedValue('hashed-password');

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'newuser@example.com', password: 'password123' });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    test('should return 409 if user already exists', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'existing@example.com' });
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'existing@example.com', password: 'password123' });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: 'User already exists' });
    });

    test('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'invalid-email', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    test('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    test('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    test('should handle database error when checking user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error when inserting user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      bcrypt.hash.mockResolvedValue('hashed-password');

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Insert failed'));
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create user' });
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login existing user with correct password', async () => {
      const existingUser = {
        email: 'existing@example.com',
        password_hash: 'hashed-password',
        created_at: '2024-01-01T00:00:00.000Z'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, existingUser);
      });

      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'existing@example.com', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.email).toBe('existing@example.com');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    test('should return 401 for wrong password', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, {
          email: 'test@example.com',
          password_hash: 'hashed-password',
          created_at: '2024-01-01T00:00:00.000Z'
        });
      });

      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid email or password' });
    });

    test('should return 401 for non-existent user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid email or password' });
    });

    test('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid-email', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    test('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    test('should handle database error when checking user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle unexpected errors in try-catch block', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should clear the token cookie', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Logged out successfully' });
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

      const token = makeToken({ email: 'test@example.com' });
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `token=${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.createdAt).toBe('2024-01-01T00:00:00.000Z');
    });

    test('should return 401 if no token cookie provided', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Authentication required' });
    });

    test('should return 404 if user not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT email FROM users WHERE email = ?')) {
          callback(null, { email: 'test@example.com' });
        } else {
          callback(null, null);
        }
      });

      const token = makeToken({ email: 'test@example.com' });
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `token=${token}`);

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

      const token = makeToken({ email: 'test@example.com' });
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `token=${token}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });
});
