const {
  parseIdParam,
  validateIdParam,
  buildUpdateSet,
  handleDbError
} = require('../../routes/helpers');

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

  describe('validateIdParam', () => {
    let res;
    let next;

    beforeEach(() => {
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      next = jest.fn();
    });

    test('should store the parsed ID on req.parsedId and call next', () => {
      const req = { params: { id: '12' } };

      validateIdParam('client')(req, res, next);

      expect(req.parsedId).toBe(12);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should respond with 400 and a labeled message for an invalid ID', () => {
      const req = { params: { id: 'abc' } };

      validateIdParam('work entry')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid work entry ID' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('buildUpdateSet', () => {
    const fieldSpecs = [
      { column: 'name', key: 'name' },
      { column: 'description', key: 'description', nullable: true }
    ];

    test('should include only fields present in the value object', () => {
      const { setClause, values } = buildUpdateSet(fieldSpecs, { name: 'Acme' });

      expect(setClause).toBe('name = ?, updated_at = CURRENT_TIMESTAMP');
      expect(values).toEqual(['Acme']);
    });

    test('should coerce empty nullable fields to null', () => {
      const { setClause, values } = buildUpdateSet(fieldSpecs, { description: '' });

      expect(setClause).toBe('description = ?, updated_at = CURRENT_TIMESTAMP');
      expect(values).toEqual([null]);
    });

    test('should build clauses for multiple fields in spec order', () => {
      const { setClause, values } = buildUpdateSet(fieldSpecs, {
        name: 'Acme',
        description: 'A client'
      });

      expect(setClause).toBe('name = ?, description = ?, updated_at = CURRENT_TIMESTAMP');
      expect(values).toEqual(['Acme', 'A client']);
    });

    test('should only append the timestamp when no fields are present', () => {
      const { setClause, values } = buildUpdateSet(fieldSpecs, {});

      expect(setClause).toBe('updated_at = CURRENT_TIMESTAMP');
      expect(values).toEqual([]);
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
