const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';

function generateToken(email, options = {}) {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '24h', ...options });
}

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

  describe('Token Extraction', () => {
    test('should return 401 if no token is provided', () => {
      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should extract token from Authorization Bearer header', () => {
      const token = generateToken('test@example.com');
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateUser(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.userEmail).toBe('test@example.com');
    });

    test('should extract token from cookie', () => {
      const token = generateToken('test@example.com');
      req.cookies = { token };

      authenticateUser(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.userEmail).toBe('test@example.com');
    });

    test('should prefer Authorization header over cookie', () => {
      const headerToken = generateToken('header@example.com');
      const cookieToken = generateToken('cookie@example.com');
      req.headers['authorization'] = `Bearer ${headerToken}`;
      req.cookies = { token: cookieToken };

      authenticateUser(req, res, next);

      expect(req.userEmail).toBe('header@example.com');
    });
  });

  describe('Token Validation', () => {
    test('should authenticate valid token and set userEmail', () => {
      const token = generateToken('valid@example.com');
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateUser(req, res, next);

      expect(req.userEmail).toBe('valid@example.com');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should return 401 for invalid token', () => {
      req.headers['authorization'] = 'Bearer invalid-token-string';

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 for expired token', () => {
      const token = jwt.sign({ email: 'test@example.com' }, JWT_SECRET, { expiresIn: '-1s' });
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Token expired'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 for token signed with wrong secret', () => {
      const token = jwt.sign({ email: 'test@example.com' }, 'wrong-secret', { expiresIn: '24h' });
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing cookies object gracefully', () => {
      req.cookies = undefined;
      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('should handle Authorization header without Bearer prefix', () => {
      const token = generateToken('test@example.com');
      req.headers['authorization'] = token;

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
