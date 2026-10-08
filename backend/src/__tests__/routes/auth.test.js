const request = require('supertest');
const express = require('express');
const authRoutes = require('../../routes/auth');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');

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
  describe('GET /api/auth/me/export', () => {
    test('should export all personal data for the user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'test@example.com', created_at: '2024-01-01' });
      });
      mockDb.all = jest.fn((query, params, callback) => {
        expect(params).toEqual(['test@example.com']);
        if (query.includes('FROM clients')) {
          callback(null, [{ id: 1, name: 'Acme', email: 'contact@acme.com' }]);
        } else {
          callback(null, [{ id: 2, client_id: 1, hours: 3 }]);
        }
      });

      const response = await request(app)
        .get('/api/auth/me/export')
        .set('x-user-email', 'test@example.com');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body.user).toEqual({ email: 'test@example.com', createdAt: '2024-01-01' });
      expect(response.body.clients).toHaveLength(1);
      expect(response.body.workEntries).toHaveLength(1);
      expect(response.body.exportedAt).toBeDefined();
    });

    test('should return 404 if user not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT email FROM users WHERE email = ?')) {
          callback(null, { email: 'test@example.com' });
        } else {
          callback(null, null);
        }
      });

      const response = await request(app)
        .get('/api/auth/me/export')
        .set('x-user-email', 'test@example.com');

      expect(response.status).toBe(404);
    });

    test('should handle database error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'test@example.com', created_at: '2024-01-01' });
      });
      mockDb.all = jest.fn((query, params, callback) => callback(new Error('fail'), null));

      const response = await request(app)
        .get('/api/auth/me/export')
        .set('x-user-email', 'test@example.com');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('DELETE /api/auth/me', () => {
    test('should erase work entries, clients and the user record', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'test@example.com' });
      });
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app)
        .delete('/api/auth/me')
        .set('x-user-email', 'test@example.com');

      expect(response.status).toBe(200);
      const queries = mockDb.run.mock.calls.map(call => call[0]);
      expect(queries).toEqual([
        'DELETE FROM work_entries WHERE user_email = ?',
        'DELETE FROM clients WHERE user_email = ?',
        'DELETE FROM users WHERE email = ?'
      ]);
      mockDb.run.mock.calls.forEach(call => expect(call[1]).toEqual(['test@example.com']));
    });

    test('should return 500 and stop if a delete fails', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'test@example.com' });
      });
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('fail')));

      const response = await request(app)
        .delete('/api/auth/me')
        .set('x-user-email', 'test@example.com');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete account' });
      expect(mockDb.run).toHaveBeenCalledTimes(1);
    });
  });
});
