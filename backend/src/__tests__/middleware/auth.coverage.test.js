const { createMockDb } = require('../helpers/testSetup');
const { authenticateUser } = require('../../middleware/auth');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');

describe('Authentication Middleware - Coverage Improvement', () => {
  let req, res, next, mockDb;

  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    mockDb = createMockDb();
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => { jest.clearAllMocks(); });

  describe('Email Format Edge Cases', () => {
    test.each([
      ['spaces before @', 'test user@example.com'],
      ['spaces after @', 'test@exam ple.com'],
      ['starting with @', '@example.com']
    ])('should reject email with %s', (_, email) => {
      req.headers['x-user-email'] = email;
      authenticateUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should accept email with double dots in domain (regex allows it)', () => {
      req.headers['x-user-email'] = 'test@example..com';
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'test@example..com' });
      });
      authenticateUser(req, res, next);
      expect(mockDb.get).toHaveBeenCalled();
    });

    test.each([
      ['numbers', 'user123@example456.com'],
      ['hyphens in domain', 'user@my-example.com'],
      ['dots in local part', 'first.last@example.com'],
      ['plus sign', 'user+tag@example.com']
    ])('should accept valid email with %s', (_, email) => {
      req.headers['x-user-email'] = email;
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email });
      });
      authenticateUser(req, res, next);
      expect(mockDb.get).toHaveBeenCalled();
    });
  });

  describe('Database Interaction Edge Cases', () => {
    test('should set req.userEmail for existing user', (done) => {
      req.headers['x-user-email'] = 'existing@test.com';
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'existing@test.com' });
      });
      authenticateUser(req, res, next);
      setImmediate(() => {
        expect(req.userEmail).toBe('existing@test.com');
        expect(next).toHaveBeenCalled();
        done();
      });
    });

    test('should set req.userEmail for newly created user', (done) => {
      req.headers['x-user-email'] = 'new-user@test.com';
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));
      authenticateUser(req, res, next);
      setImmediate(() => {
        expect(req.userEmail).toBe('new-user@test.com');
        expect(next).toHaveBeenCalled();
        done();
      });
    });

    test('should pass correct email to database query', (done) => {
      req.headers['x-user-email'] = 'specific@test.com';
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'specific@test.com' });
      });
      authenticateUser(req, res, next);
      setImmediate(() => {
        expect(mockDb.get).toHaveBeenCalledWith(
          'SELECT email FROM users WHERE email = ?',
          ['specific@test.com'],
          expect.any(Function)
        );
        done();
      });
    });

    test('should pass correct email to INSERT for new user', (done) => {
      req.headers['x-user-email'] = 'insert-test@test.com';
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));
      mockDb.run.mockImplementation((query, params, callback) => {
        expect(query).toBe('INSERT INTO users (email) VALUES (?)');
        expect(params).toEqual(['insert-test@test.com']);
        callback(null);
      });
      authenticateUser(req, res, next);
      setImmediate(() => {
        expect(next).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('Error Response Format', () => {
    test('should return 401 JSON error for missing header', () => {
      authenticateUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'User email required in x-user-email header' });
    });

    test('should return 400 JSON error for invalid email', () => {
      req.headers['x-user-email'] = 'invalid';
      authenticateUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid email format' });
    });

    test('should not call next() on authentication failure', () => {
      authenticateUser(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
