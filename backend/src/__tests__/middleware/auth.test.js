const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';

describe('Authentication Middleware (JWT)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {}
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

  describe('Missing or Malformed Token', () => {
    test('should return 401 if Authorization header is missing', () => {
      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required. Please provide a valid token.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if Authorization header does not start with Bearer', () => {
      req.headers['authorization'] = 'Basic some-token';

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required. Please provide a valid token.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if token is empty after Bearer prefix', () => {
      req.headers['authorization'] = 'Bearer ';

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Invalid Token', () => {
    test('should return 401 for an invalid JWT', () => {
      req.headers['authorization'] = 'Bearer invalid-token-string';

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token. Please log in again.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 for a token signed with wrong secret', () => {
      const token = jwt.sign({ email: 'test@example.com' }, 'wrong-secret', { expiresIn: '1h' });
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token. Please log in again.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 for an expired token', () => {
      const token = jwt.sign({ email: 'test@example.com' }, JWT_SECRET, { expiresIn: '-1s' });
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Token has expired. Please log in again.'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Valid Token', () => {
    test('should set req.userEmail and call next() for a valid token', () => {
      const token = jwt.sign({ email: 'test@example.com' }, JWT_SECRET, { expiresIn: '1h' });
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateUser(req, res, next);

      expect(req.userEmail).toBe('test@example.com');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should correctly decode email from token payload', () => {
      const token = jwt.sign({ email: 'admin@corp.com' }, JWT_SECRET, { expiresIn: '24h' });
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateUser(req, res, next);

      expect(req.userEmail).toBe('admin@corp.com');
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
