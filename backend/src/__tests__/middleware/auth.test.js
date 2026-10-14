const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../../middleware/auth');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');

// Set a test JWT secret
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only-min-32-chars';

describe('Authentication Middleware', () => {
  let req, res, next, mockDb;

  function generateToken(payload, options) {
    return jwt.sign(payload, process.env.JWT_SECRET, options || { expiresIn: '24h' });
  }

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

  describe('Authorization Header Validation', () => {
    test('should return 401 if authorization header is missing', () => {
      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authorization token required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if authorization header does not start with Bearer', () => {
      req.headers['authorization'] = 'Basic some-token';

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authorization token required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 for invalid JWT token', () => {
      req.headers['authorization'] = 'Bearer invalid-token';

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 for expired JWT token', () => {
      // Create a token that is already expired by setting exp to the past
      const payload = { email: 'test@example.com', iat: Math.floor(Date.now() / 1000) - 3600, exp: Math.floor(Date.now() / 1000) - 60 };
      const expiredToken = jwt.sign(payload, process.env.JWT_SECRET);
      req.headers['authorization'] = `Bearer ${expiredToken}`;

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Token expired'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if token payload has no email', () => {
      const tokenNoEmail = jwt.sign({ userId: 123 }, process.env.JWT_SECRET, { expiresIn: '24h' });
      req.headers['authorization'] = `Bearer ${tokenNoEmail}`;

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token payload'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Authenticated User Verification', () => {
    test('should authenticate existing user and call next()', (done) => {
      const token = generateToken({ email: 'existing@example.com' });
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

    test('should return 401 if user not found in database', (done) => {
      const token = generateToken({ email: 'deleted@example.com' });
      req.headers['authorization'] = `Bearer ${token}`;
      
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

    test('should handle database error when verifying user', (done) => {
      const token = generateToken({ email: 'test@example.com' });
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
});
