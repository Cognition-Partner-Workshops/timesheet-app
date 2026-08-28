const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../../middleware/auth');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');

const TEST_SECRET = process.env.JWT_SECRET;

function generateTestToken(email) {
  return jwt.sign({ email }, TEST_SECRET, { expiresIn: '24h' });
}

describe('Authentication Middleware', () => {
  let req, res, next, mockDb;

  beforeEach(() => {
    req = {
      headers: {}
    };
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

  describe('Token Validation', () => {
    test('should return 401 if Authorization header is missing', () => {
      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required. Provide a valid Bearer token.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if Authorization header is not Bearer', () => {
      req.headers['authorization'] = 'Basic abc123';

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required. Provide a valid Bearer token.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 for invalid JWT token', () => {
      req.headers['authorization'] = 'Bearer invalidtoken';

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token. Please log in again.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 for expired JWT token', () => {
      const expiredToken = jwt.sign({ email: 'test@example.com' }, TEST_SECRET, { expiresIn: '-1s' });
      req.headers['authorization'] = `Bearer ${expiredToken}`;

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Token expired. Please log in again.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should accept valid JWT token and look up user', () => {
      const token = generateTestToken('test@example.com');
      req.headers['authorization'] = `Bearer ${token}`;

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'test@example.com' });
      });

      authenticateUser(req, res, next);

      expect(mockDb.get).toHaveBeenCalled();
    });
  });

  describe('Existing User Authentication', () => {
    test('should authenticate existing user and call next()', (done) => {
      const token = generateTestToken('existing@example.com');
      req.headers['authorization'] = `Bearer ${token}`;

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'existing@example.com' });
      });

      authenticateUser(req, res, next);

      setImmediate(() => {
        expect(req.userEmail).toBe('existing@example.com');
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
        done();
      });
    });

    test('should handle database error when checking user', (done) => {
      const token = generateTestToken('test@example.com');
      req.headers['authorization'] = `Bearer ${token}`;

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      authenticateUser(req, res, next);

      setImmediate(() => {
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Internal server error'
        });
        expect(next).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe('User Not Found', () => {
    test('should return 401 if user not found in database', (done) => {
      const token = generateTestToken('nonexistent@example.com');
      req.headers['authorization'] = `Bearer ${token}`;

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null); // User doesn't exist
      });

      authenticateUser(req, res, next);

      setImmediate(() => {
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: 'User not found. Please log in again.'
        });
        expect(next).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe('Token Edge Cases', () => {
    test('should return 401 for token without email claim', () => {
      const token = jwt.sign({ id: 123 }, TEST_SECRET, { expiresIn: '24h' });
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token: missing email claim'
      });
    });

    test('should accept token with subdomain email', () => {
      const token = generateTestToken('test@mail.example.com');
      req.headers['authorization'] = `Bearer ${token}`;

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'test@mail.example.com' });
      });

      authenticateUser(req, res, next);
      expect(mockDb.get).toHaveBeenCalled();
    });
  });
});
