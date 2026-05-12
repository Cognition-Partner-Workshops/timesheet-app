const { authenticateUser } = require('../../middleware/auth');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');

describe('Authentication Middleware - Coverage Improvement', () => {
  let req, res, next, mockDb;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    mockDb = {
      get: jest.fn(),
      run: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Email Format Edge Cases', () => {
    test('should reject email with spaces before @', () => {
      req.headers['x-user-email'] = 'test user@example.com';
      authenticateUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should reject email with spaces after @', () => {
      req.headers['x-user-email'] = 'test@exam ple.com';
      authenticateUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should accept email with double dots in domain (regex allows it)', () => {
      req.headers['x-user-email'] = 'test@example..com';
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'test@example..com' });
      });

      authenticateUser(req, res, next);
      // The simple regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/ allows double dots
      expect(mockDb.get).toHaveBeenCalled();
    });

    test('should accept valid email with numbers', () => {
      req.headers['x-user-email'] = 'user123@example456.com';
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'user123@example456.com' });
      });

      authenticateUser(req, res, next);
      expect(mockDb.get).toHaveBeenCalled();
    });

    test('should accept email with hyphens in domain', () => {
      req.headers['x-user-email'] = 'user@my-example.com';
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'user@my-example.com' });
      });

      authenticateUser(req, res, next);
      expect(mockDb.get).toHaveBeenCalled();
    });

    test('should accept email with dots in local part', () => {
      req.headers['x-user-email'] = 'first.last@example.com';
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'first.last@example.com' });
      });

      authenticateUser(req, res, next);
      expect(mockDb.get).toHaveBeenCalled();
    });

    test('should accept email with plus sign', () => {
      req.headers['x-user-email'] = 'user+tag@example.com';
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'user+tag@example.com' });
      });

      authenticateUser(req, res, next);
      expect(mockDb.get).toHaveBeenCalled();
    });

    test('should reject email starting with @', () => {
      req.headers['x-user-email'] = '@example.com';
      authenticateUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
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
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

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
        expect(params).toEqual(['specific@test.com']);
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
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });
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
    test('should return proper JSON error for missing header', () => {
      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User email required in x-user-email header'
      });
    });

    test('should return proper JSON error for invalid email', () => {
      req.headers['x-user-email'] = 'invalid';
      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid email format'
      });
    });

    test('should not call next() on authentication failure', () => {
      authenticateUser(req, res, next);

      expect(next).not.toHaveBeenCalled();
    });
  });
});
