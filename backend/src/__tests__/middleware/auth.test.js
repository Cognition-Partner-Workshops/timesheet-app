const jwt = require('jsonwebtoken');
const { authenticateUser, requireRole, JWT_SECRET } = require('../../middleware/auth');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      cookies: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Token Validation', () => {
    test('should return 401 if no token provided', () => {
      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 for invalid token', () => {
      req.cookies = { token: 'invalid-token' };

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 for expired token', () => {
      const expiredToken = jwt.sign(
        { email: 'test@example.com', role: 'user' },
        JWT_SECRET,
        { expiresIn: '-1s' }
      );
      req.cookies = { token: expiredToken };

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Token expired'
      });
    });
  });

  describe('Valid Token Authentication', () => {
    test('should authenticate user with valid cookie token', () => {
      const token = jwt.sign(
        { email: 'test@example.com', role: 'user' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      req.cookies = { token };

      authenticateUser(req, res, next);

      expect(req.userEmail).toBe('test@example.com');
      expect(req.userRole).toBe('user');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should authenticate user with Bearer token', () => {
      const token = jwt.sign(
        { email: 'test@example.com', role: 'admin' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateUser(req, res, next);

      expect(req.userEmail).toBe('test@example.com');
      expect(req.userRole).toBe('admin');
      expect(next).toHaveBeenCalled();
    });

    test('should default role to user if not in token', () => {
      const token = jwt.sign(
        { email: 'test@example.com' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      req.cookies = { token };

      authenticateUser(req, res, next);

      expect(req.userRole).toBe('user');
    });
  });

  describe('requireRole middleware', () => {
    test('should allow access for matching role', () => {
      req.userRole = 'admin';
      const middleware = requireRole('admin');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow admin access to any role', () => {
      req.userRole = 'admin';
      const middleware = requireRole('user');
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
      expect(next).not.toHaveBeenCalled();
    });
  });
});
