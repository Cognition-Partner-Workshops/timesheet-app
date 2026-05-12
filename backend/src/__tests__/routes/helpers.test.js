const { parseResourceId, handleDbError, buildDynamicUpdate } = require('../../routes/helpers');

jest.mock('../../database/init');

describe('Route Helpers', () => {
  describe('parseResourceId', () => {
    test('should parse valid integer ID', () => {
      const req = { params: { id: '42' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      expect(parseResourceId(req, res, 'widget')).toBe(42);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should return null and send 400 for non-numeric ID', () => {
      const req = { params: { id: 'abc' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      expect(parseResourceId(req, res, 'widget')).toBeNull();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid widget ID' });
    });
  });

  describe('handleDbError', () => {
    test('should send 500 with default message', () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      handleDbError(res, new Error('fail'));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    test('should send 500 with custom message', () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      handleDbError(res, new Error('fail'), 'Custom error');
      expect(res.json).toHaveBeenCalledWith({ error: 'Custom error' });
    });
  });

  describe('buildDynamicUpdate', () => {
    const fieldMap = {
      name: { column: 'name', nullable: false },
      description: { column: 'description', nullable: true },
      status: { column: 'status', nullable: false }
    };

    test('should build update for provided fields', () => {
      const result = buildDynamicUpdate('tbl', fieldMap, { name: 'X', status: 'active' });
      expect(result.updates).toContain('name = ?');
      expect(result.updates).toContain('status = ?');
      expect(result.updates).toContain('updated_at = CURRENT_TIMESTAMP');
      expect(result.values).toEqual(['X', 'active']);
    });

    test('should coerce nullable empty string to null', () => {
      const result = buildDynamicUpdate('tbl', fieldMap, { description: '' });
      expect(result.values).toEqual([null]);
    });

    test('should keep non-nullable value as-is', () => {
      const result = buildDynamicUpdate('tbl', fieldMap, { name: 'Hello' });
      expect(result.values).toEqual(['Hello']);
    });
  });
});
