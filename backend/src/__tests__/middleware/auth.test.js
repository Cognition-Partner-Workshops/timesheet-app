const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function expectRejected(expectedError) {
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: expectedError });
    expect(next).not.toHaveBeenCalled();
  }

  function expectAccepted(expectedEmail) {
    expect(req.userEmail).toBe(expectedEmail);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  }

  describe('JWT Token Validation', () => {
    test('should return 401 if Authorization header is missing', () => {
      authenticateUser(req, res, next);
      expectRejected('Authorization token required');
    });

    test('should return 401 if Authorization header does not start with Bearer', () => {
      req.headers['authorization'] = 'Basic sometoken';
      authenticateUser(req, res, next);
      expectRejected('Authorization token required');
    });

    test('should return 401 if token is invalid', () => {
      req.headers['authorization'] = 'Bearer invalid-token';
      authenticateUser(req, res, next);
      expectRejected('Invalid or expired token');
    });

    test('should return 401 if token is expired', () => {
      const expiredToken = jwt.sign({ email: 'test@example.com' }, JWT_SECRET, { expiresIn: '-1h' });
      req.headers['authorization'] = `Bearer ${expiredToken}`;
      authenticateUser(req, res, next);
      expectRejected('Invalid or expired token');
    });

    test('should authenticate with valid JWT and set req.userEmail', () => {
      const token = jwt.sign({ email: 'test@example.com' }, JWT_SECRET, { expiresIn: '24h' });
      req.headers['authorization'] = `Bearer ${token}`;
      authenticateUser(req, res, next);
      expectAccepted('test@example.com');
    });

    test('should reject token signed with different secret', () => {
      const differentSecret = require('crypto').randomBytes(32).toString('hex');
      const token = jwt.sign({ email: 'test@example.com' }, differentSecret, { expiresIn: '24h' });
      req.headers['authorization'] = `Bearer ${token}`;
      authenticateUser(req, res, next);
      expectRejected('Invalid or expired token');
    });
  });

  describe('Regression: old x-user-email header', () => {
    test('should NOT grant access with only x-user-email header (no JWT)', () => {
      req.headers['x-user-email'] = 'test@example.com';
      authenticateUser(req, res, next);
      expectRejected('Authorization token required');
    });
  });

  describe('Data isolation', () => {
    test('should set req.userEmail from JWT payload, not from any header', () => {
      const token = jwt.sign({ email: 'real@example.com' }, JWT_SECRET, { expiresIn: '24h' });
      req.headers['authorization'] = `Bearer ${token}`;
      req.headers['x-user-email'] = 'attacker@example.com';
      authenticateUser(req, res, next);
      expectAccepted('real@example.com');
    });
  });
});
