const { errorHandler } = require('../../middleware/errorHandler');

describe('Error Handler Middleware - Coverage Improvement', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('SQLite Error Variants', () => {
    test('should handle SQLITE_BUSY error', () => {
      const error = { code: 'SQLITE_BUSY', message: 'Database is locked' };
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Database error',
        message: 'An error occurred while processing your request'
      });
    });

    test('should handle SQLITE_READONLY error', () => {
      const error = { code: 'SQLITE_READONLY', message: 'Read-only database' };
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Database error',
        message: 'An error occurred while processing your request'
      });
    });

    test('should handle SQLITE_CORRUPT error', () => {
      const error = { code: 'SQLITE_CORRUPT', message: 'Database disk image is malformed' };
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should not treat non-SQLITE_ code as database error', () => {
      const error = { code: 'ECONNREFUSED', message: 'Connection refused' };
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Connection refused' });
    });
  });

  describe('Joi Error Edge Cases', () => {
    test('should handle Joi error with multiple detail messages', () => {
      const error = {
        isJoi: true,
        details: [
          { message: 'Name is required' },
          { message: 'Email must be valid' },
          { message: 'Hours must be positive' }
        ]
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        details: ['Name is required', 'Email must be valid', 'Hours must be positive']
      });
    });

    test('should handle Joi error with empty details array', () => {
      const error = {
        isJoi: true,
        details: []
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        details: []
      });
    });
  });

  describe('Generic Error Edge Cases', () => {
    test('should handle error with status 400', () => {
      const error = { status: 400, message: 'Bad request' };
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Bad request' });
    });

    test('should handle error with status 404', () => {
      const error = { status: 404, message: 'Not found' };
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('should handle error with status 422', () => {
      const error = { status: 422, message: 'Unprocessable entity' };
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
    });

    test('should handle Error instance with stack trace', () => {
      const error = new Error('Runtime failure');
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Runtime failure' });
      expect(console.error).toHaveBeenCalledWith('Error:', error);
    });

    test('should handle error with null message', () => {
      const error = { message: null };
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    test('should handle error with undefined message', () => {
      const error = { message: undefined };
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    test('should handle error with status 0', () => {
      const error = { status: 0, message: 'Zero status' };
      errorHandler(error, req, res, next);

      // 0 is falsy, so it should default to 500
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
