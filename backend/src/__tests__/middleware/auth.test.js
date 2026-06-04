const { authenticateUser } = require('../../middleware/auth');
const { getDatabase } = require('../../database/init');
const oidc = require('../../middleware/oidc');

jest.mock('../../database/init');
jest.mock('../../middleware/oidc');

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
    oidc.isOidcEnabled.mockReturnValue(false);
    oidc.extractBearerToken.mockReturnValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Email Header Validation', () => {
    test('should return 401 if x-user-email header is missing', () => {
      authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User email required in x-user-email header'
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

    test('should accept valid email format', () => {
      req.headers['x-user-email'] = 'test@example.com';
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'test@example.com' });
      });

      authenticateUser(req, res, next);

      expect(mockDb.get).toHaveBeenCalled();
    });
  });

  describe('Existing User Authentication', () => {
    test('should authenticate existing user and call next()', (done) => {
      req.headers['x-user-email'] = 'existing@example.com';
      
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

  describe('New User Creation', () => {
    test('should create new user if not exists and call next()', (done) => {
      req.headers['x-user-email'] = 'newuser@example.com';
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null); // User doesn't exist
      });
      
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      authenticateUser(req, res, next);

      setImmediate(() => {
        expect(mockDb.run).toHaveBeenCalledWith(
          'INSERT INTO users (email) VALUES (?)',
          ['newuser@example.com'],
          expect.any(Function)
        );
        expect(req.userEmail).toBe('newuser@example.com');
        expect(next).toHaveBeenCalled();
        done();
      });
    });

    test('should handle error when creating new user', (done) => {
      req.headers['x-user-email'] = 'newuser@example.com';
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });
      
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Insert failed'));
      });

      authenticateUser(req, res, next);

      setImmediate(() => {
        expect(res.status).toHaveBeenCalledWith(500);
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

    test('should accept email with subdomain', () => {
      req.headers['x-user-email'] = 'test@mail.example.com';
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'test@mail.example.com' });
      });

      authenticateUser(req, res, next);
      expect(mockDb.get).toHaveBeenCalled();
    });
  });

  describe('OIDC Bearer Token Authentication', () => {
    test('should verify Bearer token when OIDC is enabled', (done) => {
      oidc.extractBearerToken.mockReturnValue('valid-jwt-token');
      oidc.isOidcEnabled.mockReturnValue(true);
      oidc.verifyOidcToken.mockResolvedValue({
        email: 'oidc-user@example.com',
        subject: 'sub-123',
        claims: { iss: 'https://issuer.example.com' },
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'oidc-user@example.com' });
      });

      authenticateUser(req, res, next);

      setImmediate(() => {
        expect(oidc.verifyOidcToken).toHaveBeenCalledWith('valid-jwt-token');
        expect(req.userEmail).toBe('oidc-user@example.com');
        expect(next).toHaveBeenCalled();
        done();
      });
    });

    test('should return 401 for invalid Bearer token', (done) => {
      oidc.extractBearerToken.mockReturnValue('bad-token');
      oidc.isOidcEnabled.mockReturnValue(true);
      oidc.verifyOidcToken.mockRejectedValue(new Error('signature verification failed'));

      authenticateUser(req, res, next);

      setImmediate(() => {
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
        expect(next).not.toHaveBeenCalled();
        done();
      });
    });

    test('should fall back to email header when no Bearer token present and OIDC enabled', () => {
      oidc.extractBearerToken.mockReturnValue(null);
      oidc.isOidcEnabled.mockReturnValue(true);
      req.headers['x-user-email'] = 'fallback@example.com';

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'fallback@example.com' });
      });

      authenticateUser(req, res, next);

      expect(oidc.verifyOidcToken).not.toHaveBeenCalled();
      expect(mockDb.get).toHaveBeenCalled();
    });

    test('should fall back to email header when OIDC is not enabled even with Bearer token', () => {
      oidc.extractBearerToken.mockReturnValue('some-token');
      oidc.isOidcEnabled.mockReturnValue(false);
      req.headers['x-user-email'] = 'legacy@example.com';

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { email: 'legacy@example.com' });
      });

      authenticateUser(req, res, next);

      expect(oidc.verifyOidcToken).not.toHaveBeenCalled();
      expect(mockDb.get).toHaveBeenCalled();
    });

    test('should create new user on first OIDC login', (done) => {
      oidc.extractBearerToken.mockReturnValue('new-user-token');
      oidc.isOidcEnabled.mockReturnValue(true);
      oidc.verifyOidcToken.mockResolvedValue({
        email: 'new-oidc@example.com',
        subject: 'sub-456',
        claims: { iss: 'https://issuer.example.com' },
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      authenticateUser(req, res, next);

      setImmediate(() => {
        expect(mockDb.run).toHaveBeenCalledWith(
          'INSERT INTO users (email) VALUES (?)',
          ['new-oidc@example.com'],
          expect.any(Function)
        );
        expect(req.userEmail).toBe('new-oidc@example.com');
        expect(next).toHaveBeenCalled();
        done();
      });
    });

    test('should return 500 on DB error during OIDC auth', (done) => {
      oidc.extractBearerToken.mockReturnValue('valid-token');
      oidc.isOidcEnabled.mockReturnValue(true);
      oidc.verifyOidcToken.mockResolvedValue({
        email: 'user@example.com',
        subject: 'sub-789',
        claims: { iss: 'https://issuer.example.com' },
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('DB down'));
      });

      authenticateUser(req, res, next);

      setImmediate(() => {
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
        expect(next).not.toHaveBeenCalled();
        done();
      });
    });
  });
});
