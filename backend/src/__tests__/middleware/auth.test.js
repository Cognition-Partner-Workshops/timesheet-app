const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../../middleware/auth');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');

const JWT_SECRET = 'test-secret-key';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET);
}

describe('Authentication Middleware', () => {
  let req, res, next, mockDb;
  const originalEnv = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    req = {
      cookies: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    
    mockDb = {
      get: jest.fn()
    };
    
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalEnv;
    jest.clearAllMocks();
  });

  describe('Token Validation', () => {
    test('should return 401 if no token cookie is present', () => {
      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if token is invalid', () => {
      req.cookies.token = 'invalid-token';

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if token is expired', () => {
      const expiredToken = jwt.sign({ email: 'test@example.com' }, JWT_SECRET, { expiresIn: '-1s' });
      req.cookies.token = expiredToken;

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
    });
  });

  describe('Existing User Authentication', () => {
    test('should authenticate existing user and call next()', (done) => {
      req.cookies.token = makeToken({ email: 'existing@example.com' });
      
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

    test('should return 401 if user not found in database', (done) => {
      req.cookies.token = makeToken({ email: 'deleted@example.com' });
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      authenticateUser(req, res, next);

      setImmediate(() => {
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: 'User not found'
        });
        expect(next).not.toHaveBeenCalled();
        done();
      });
    });

    test('should handle database error when checking user', (done) => {
      req.cookies.token = makeToken({ email: 'test@example.com' });
      
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

  describe('Token signed with wrong secret', () => {
    test('should return 401 for token signed with different secret', () => {
      const wrongToken = jwt.sign({ email: 'test@example.com' }, 'wrong-secret');
      req.cookies.token = wrongToken;

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
    });
  });
});
