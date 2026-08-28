const { dbAll, dbGet, dbRun, buildUpdateQuery } = require('../../database/helpers');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');

describe('database helpers', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => jest.clearAllMocks());

  describe('dbAll', () => {
    it('resolves with rows', async () => {
      mockDb.all.mockImplementation((q, p, cb) => cb(null, [{ id: 1 }]));
      const rows = await dbAll('SELECT 1', []);
      expect(rows).toEqual([{ id: 1 }]);
    });

    it('rejects on error', async () => {
      mockDb.all.mockImplementation((q, p, cb) => cb(new Error('fail')));
      await expect(dbAll('SELECT 1', [])).rejects.toThrow('fail');
    });
  });

  describe('dbGet', () => {
    it('resolves with row', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, { id: 1 }));
      const row = await dbGet('SELECT 1', []);
      expect(row).toEqual({ id: 1 });
    });

    it('resolves with null when not found', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, null));
      const row = await dbGet('SELECT 1', []);
      expect(row).toBeNull();
    });

    it('rejects on error', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(new Error('fail')));
      await expect(dbGet('SELECT 1', [])).rejects.toThrow('fail');
    });
  });

  describe('dbRun', () => {
    it('resolves with lastID and changes', async () => {
      mockDb.run.mockImplementation(function(q, p, cb) {
        cb.call({ lastID: 42, changes: 1 }, null);
      });
      const result = await dbRun('INSERT ...', []);
      expect(result).toEqual({ lastID: 42, changes: 1 });
    });

    it('rejects on error', async () => {
      mockDb.run.mockImplementation(function(q, p, cb) {
        cb.call(this, new Error('fail'));
      });
      await expect(dbRun('INSERT ...', [])).rejects.toThrow('fail');
    });
  });

  describe('buildUpdateQuery', () => {
    it('builds SET clause from defined fields', () => {
      const { sql, params } = buildUpdateQuery('projects', { name: 'X', status: 'active', description: undefined }, 1, 'u@e.com');
      expect(sql).toContain('UPDATE projects SET');
      expect(sql).toContain('name = ?');
      expect(sql).toContain('status = ?');
      expect(sql).not.toContain('description');
      expect(sql).toContain('updated_at = CURRENT_TIMESTAMP');
      expect(params).toEqual(['X', 'active', 1, 'u@e.com']);
    });
  });
});
