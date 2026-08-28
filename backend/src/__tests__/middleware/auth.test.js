const jwt = require('jsonwebtoken');
const { authenticateUser, requireRole } = require('../../middleware/auth');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');

const JWT_SECRET = 'default-dev-secret';

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

  describe('JWT Authentication', () => {
    test('should authenticate with valid JWT token', () => {
      const token = jwt.sign({ email: 'test@example.com', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateUser(req, res, next);

      expect(req.userEmail).toBe('test@example.com');
      expect(req.userRole).toBe('user');
      expect(next).toHaveBeenCalled();
    });

    test('should authenticate admin with valid JWT token', () => {
      const token = jwt.sign({ email: 'admin@example.com', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateUser(req, res, next);

      expect(req.userEmail).toBe('admin@example.com');
      expect(req.userRole).toBe('admin');
      expect(next).toHaveBeenCalled();
    });

    test('should return 401 for invalid JWT token', () => {
      req.headers['authorization'] = 'Bearer invalid-token';

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 for expired JWT token', () => {
      const token = jwt.sign({ email: 'test@example.com', role: 'user' }, JWT_SECRET, { expiresIn: '-1h' });
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
    });
  });

  describe('Legacy Email Header Fallback', () => {
    test('should return 401 if no auth header provided', () => {
      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 400 if email format is invalid', () => {
      req.headers['x-user-email'] = 'invalid-email';

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid email format'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should authenticate existing user via email header', (done) => {
      req.headers['x-user-email'] = 'existing@example.com';
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'existing@example.com', role: 'user' });
      });

      authenticateUser(req, res, next);

      setImmediate(() => {
        expect(req.userEmail).toBe('existing@example.com');
        expect(req.userRole).toBe('user');
        expect(next).toHaveBeenCalled();
        done();
      });
    });

    test('should return 401 if user not found via email header', (done) => {
      req.headers['x-user-email'] = 'unknown@example.com';
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      authenticateUser(req, res, next);

      setImmediate(() => {
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: 'User not found. Please register first.'
        });
        expect(next).not.toHaveBeenCalled();
        done();
      });
    });

    test('should handle database error when checking user', (done) => {
      req.headers['x-user-email'] = 'test@example.com';
      
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

  describe('Email Format Edge Cases', () => {
    test('should reject email without @', () => {
      req.headers['x-user-email'] = 'notanemail';
      authenticateUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should reject email without domain', () => {
      req.headers['x-user-email'] = 'test@';
      authenticateUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should reject email without TLD', () => {
      req.headers['x-user-email'] = 'test@domain';
      authenticateUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should accept email with valid format', (done) => {
      req.headers['x-user-email'] = 'valid@example.com';
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'valid@example.com', role: 'user' });
      });

      authenticateUser(req, res, next);

      setImmediate(() => {
        expect(mockDb.get).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('requireRole Middleware', () => {
    test('should allow access for matching role', () => {
      req.userRole = 'admin';
      const middleware = requireRole('admin');
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('should deny access for non-matching role', () => {
      req.userRole = 'user';
      const middleware = requireRole('admin');
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions'
      });
    });

    test('should allow access when role is in list', () => {
      req.userRole = 'user';
      const middleware = requireRole('admin', 'user');
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('should deny access when userRole is missing', () => {
      const middleware = requireRole('admin');
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
