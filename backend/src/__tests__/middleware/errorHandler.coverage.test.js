const { errorHandler } = require('../../middleware/errorHandler');

describe('Error Handler Middleware - Coverage Improvement', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  describe('SQLite Error Variants', () => {
    test.each([
      ['SQLITE_BUSY', 'Database is locked'],
      ['SQLITE_READONLY', 'Read-only database'],
      ['SQLITE_CORRUPT', 'Database disk image is malformed']
    ])('should handle %s error as database error', (code, message) => {
      errorHandler({ code, message }, req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Database error',
        message: 'An error occurred while processing your request'
      });
    });

    test('should not treat non-SQLITE_ code as database error', () => {
      errorHandler({ code: 'ECONNREFUSED', message: 'Connection refused' }, req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Connection refused' });
    });
  });

  describe('Joi Error Edge Cases', () => {
    test('should handle Joi error with multiple detail messages', () => {
      const details = [{ message: 'Name is required' }, { message: 'Email must be valid' }, { message: 'Hours must be positive' }];
      errorHandler({ isJoi: true, details }, req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        details: ['Name is required', 'Email must be valid', 'Hours must be positive']
      });
    });

    test('should handle Joi error with empty details array', () => {
      errorHandler({ isJoi: true, details: [] }, req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Validation error', details: [] });
    });
  });

  describe('Generic Error Edge Cases', () => {
    test.each([
      [400, 'Bad request'],
      [404, 'Not found'],
      [422, 'Unprocessable entity']
    ])('should handle error with status %i', (status, message) => {
      errorHandler({ status, message }, req, res, next);
      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith({ error: message });
    });

    test('should handle Error instance with stack trace', () => {
      const error = new Error('Runtime failure');
      errorHandler(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Runtime failure' });
      expect(console.error).toHaveBeenCalledWith('Error:', error);
    });

    test.each([
      ['null message', { message: null }],
      ['undefined message', { message: undefined }]
    ])('should default to Internal server error for %s', (_, error) => {
      errorHandler(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    test('should default to 500 for falsy status (0)', () => {
      errorHandler({ status: 0, message: 'Zero status' }, req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
