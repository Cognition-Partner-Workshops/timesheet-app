const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const authRoutes = require('../../routes/auth');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');
jest.mock('../../services/email', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
}));

const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use((err, req, res, next) => {
  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

describe('Auth Routes (OTP + JWT)', () => {
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

  describe('POST /api/auth/login (Request OTP)', () => {
    test('should send OTP for valid email', async () => {
      // Mock: invalidate old OTPs
      mockDb.run.mockImplementation((query, params, callback) => {
        if (typeof params === 'function') {
          params(null);
        } else if (typeof callback === 'function') {
          callback(null);
        }
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Verification code sent to your email');
      expect(response.body.email).toBe('test@example.com');
      expect(response.body.expiresInMinutes).toBe(5);
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

    test('should return 500 if email sending fails', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        if (typeof params === 'function') {
          params(null);
        } else if (typeof callback === 'function') {
          callback(null);
        }
      });

      const { sendOtpEmail } = require('../../services/email');
      sendOtpEmail.mockRejectedValueOnce(new Error('SMTP error'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to send verification email. Please try again.');
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    test('should return JWT on valid OTP', async () => {
      const futureDate = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('otp_codes')) {
          callback(null, { id: 1, code: '123456', expires_at: futureDate });
        } else if (query.includes('users')) {
          callback(null, { email: 'test@example.com', created_at: '2024-01-01T00:00:00.000Z' });
        }
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        if (typeof params === 'function') {
          params(null);
        } else if (typeof callback === 'function') {
          callback(null);
        }
      });

      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'test@example.com', code: '123456' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.token).toBeDefined();

      // Verify the JWT is valid
      const decoded = jwt.verify(response.body.token, JWT_SECRET);
      expect(decoded.email).toBe('test@example.com');
    });

    test('should create new user if not existing', async () => {
      const futureDate = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('otp_codes')) {
          callback(null, { id: 1, code: '654321', expires_at: futureDate });
        } else if (query.includes('users')) {
          callback(null, null); // User doesn't exist
        }
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        if (typeof params === 'function') {
          params(null);
        } else if (typeof callback === 'function') {
          callback(null);
        }
      });

      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'newuser@example.com', code: '654321' });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.body.token).toBeDefined();
    });

    test('should return 400 for invalid OTP code', async () => {
      const futureDate = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('otp_codes')) {
          callback(null, { id: 1, code: '123456', expires_at: futureDate });
        }
      });

      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'test@example.com', code: '999999' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid verification code.');
    });

    test('should return 400 for expired OTP', async () => {
      const pastDate = new Date(Date.now() - 60 * 1000).toISOString();

      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('otp_codes')) {
          callback(null, { id: 1, code: '123456', expires_at: pastDate });
        }
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        if (typeof params === 'function') {
          params(null);
        } else if (typeof callback === 'function') {
          callback(null);
        }
      });

      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'test@example.com', code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Verification code has expired. Please request a new one.');
    });

    test('should return 400 when no pending OTP found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('otp_codes')) {
          callback(null, null);
        }
      });

      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'test@example.com', code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No pending verification code found. Please request a new one.');
    });

    test('should return 400 for non-6-digit code', async () => {
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'test@example.com', code: '12345' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    test('should return 400 for non-numeric code', async () => {
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'test@example.com', code: 'abcdef' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('POST /api/auth/resend-otp', () => {
    test('should resend OTP for valid email', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        if (typeof params === 'function') {
          params(null);
        } else if (typeof callback === 'function') {
          callback(null);
        }
      });

      const response = await request(app)
        .post('/api/auth/resend-otp')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('A new verification code has been sent to your email');
    });

    test('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/resend-otp')
        .send({ email: 'bad-email' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/me (JWT-protected)', () => {
    test('should return current user info with valid JWT', async () => {
      const user = {
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00.000Z'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, user);
      });

      const token = jwt.sign({ email: 'test@example.com' }, JWT_SECRET, { expiresIn: '1h' });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.createdAt).toBe('2024-01-01T00:00:00.000Z');
    });

    test('should return 401 if no token provided', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required. Please provide a valid token.');
    });

    test('should return 401 for expired token', async () => {
      const token = jwt.sign({ email: 'test@example.com' }, JWT_SECRET, { expiresIn: '-1s' });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token has expired. Please log in again.');
    });

    test('should return 404 if user not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const token = jwt.sign({ email: 'test@example.com' }, JWT_SECRET, { expiresIn: '1h' });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });

    test('should handle database error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const token = jwt.sign({ email: 'test@example.com' }, JWT_SECRET, { expiresIn: '1h' });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });
});
