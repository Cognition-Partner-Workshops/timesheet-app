const { parseId, buildUpdateQuery, dbAll, dbGet, dbRun } = require('../../utils/routeHelpers');

describe('routeHelpers', () => {
  describe('parseId', () => {
    it('returns parsed integer for valid numeric param', () => {
      const req = { params: { id: '42' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      expect(parseId(req, res, 'project')).toBe(42);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns null and sends 400 for non-numeric param', () => {
      const req = { params: { id: 'abc' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      expect(parseId(req, res, 'project')).toBeNull();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid project ID' });
    });
  });

  describe('buildUpdateQuery', () => {
    it('builds query from provided fields', () => {
      const fields = [
        { column: 'name', key: 'name' },
        { column: 'description', key: 'desc', transform: (v) => v || null },
      ];
      const result = buildUpdateQuery('projects', fields, { name: 'Test', desc: '' }, 1, 'u@e.com');
      expect(result.query).toBe('UPDATE projects SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?');
      expect(result.values).toEqual(['Test', null, 1, 'u@e.com']);
    });

    it('skips undefined fields', () => {
      const fields = [
        { column: 'name', key: 'name' },
        { column: 'status', key: 'status' },
      ];
      const result = buildUpdateQuery('projects', fields, { name: 'X' }, 5, 'a@b.com');
      expect(result.query).toContain('name = ?');
      expect(result.query).not.toContain('status = ?');
      expect(result.values).toEqual(['X', 5, 'a@b.com']);
    });
  });

  describe('dbAll', () => {
    it('resolves with rows on success', async () => {
      const db = { all: jest.fn((q, p, cb) => cb(null, [{ id: 1 }])) };
      const rows = await dbAll(db, 'SELECT 1', []);
      expect(rows).toEqual([{ id: 1 }]);
    });

    it('rejects on error', async () => {
      const db = { all: jest.fn((q, p, cb) => cb(new Error('fail'))) };
      await expect(dbAll(db, 'SELECT 1', [])).rejects.toThrow('fail');
    });
  });

  describe('dbGet', () => {
    it('resolves with row on success', async () => {
      const db = { get: jest.fn((q, p, cb) => cb(null, { id: 1 })) };
      const row = await dbGet(db, 'SELECT 1', []);
      expect(row).toEqual({ id: 1 });
    });

    it('rejects on error', async () => {
      const db = { get: jest.fn((q, p, cb) => cb(new Error('fail'))) };
      await expect(dbGet(db, 'SELECT 1', [])).rejects.toThrow('fail');
    });
  });

  describe('dbRun', () => {
    it('resolves with lastID and changes on success', async () => {
      const db = { run: jest.fn(function(q, p, cb) { cb.call({ lastID: 7, changes: 1 }, null); }) };
      const result = await dbRun(db, 'INSERT', []);
      expect(result).toEqual({ lastID: 7, changes: 1 });
    });

    it('rejects on error', async () => {
      const db = { run: jest.fn(function(q, p, cb) { cb.call(this, new Error('fail')); }) };
      await expect(dbRun(db, 'INSERT', [])).rejects.toThrow('fail');
    });
  });
});
