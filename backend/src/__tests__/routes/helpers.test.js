const { parseIdParam, handleDbError } = require('../../routes/helpers');

describe('Route Helpers', () => {
  describe('parseIdParam', () => {
    test('should parse a valid integer string', () => {
      expect(parseIdParam('42')).toBe(42);
    });

    test('should parse an integer with leading zeros as decimal', () => {
      expect(parseIdParam('007')).toBe(7);
    });

    test('should return null for a non-numeric string', () => {
      expect(parseIdParam('abc')).toBeNull();
    });

    test('should return null for an empty string', () => {
      expect(parseIdParam('')).toBeNull();
    });

    test('should return null for undefined', () => {
      expect(parseIdParam(undefined)).toBeNull();
    });

    test('should truncate a decimal string to its integer part', () => {
      expect(parseIdParam('3.9')).toBe(3);
    });

    test('should parse a negative integer string', () => {
      expect(parseIdParam('-5')).toBe(-5);
    });
  });

  describe('handleDbError', () => {
    let res;
    let consoleErrorSpy;

    beforeEach(() => {
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    test('should log the error and respond with 500 and default message', () => {
      const err = new Error('boom');

      handleDbError(res, err);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Database error:', err);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    test('should respond with a custom message when provided', () => {
      handleDbError(res, new Error('boom'), 'Failed to create client');

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create client' });
    });
  });
});
