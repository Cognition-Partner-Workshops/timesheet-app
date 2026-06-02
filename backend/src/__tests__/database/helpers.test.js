const { dbAll, dbGet, dbRun, buildUpdateQuery } = require('../../database/helpers');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');

describe('Database Helpers', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('dbAll', () => {
    test('should resolve with rows on success', async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      mockDb.all.mockImplementation((q, p, cb) => cb(null, rows));

      const result = await dbAll('SELECT * FROM test', []);
      expect(result).toEqual(rows);
    });

    test('should reject on error', async () => {
      mockDb.all.mockImplementation((q, p, cb) => cb(new Error('fail')));

      await expect(dbAll('SELECT * FROM test', [])).rejects.toThrow('fail');
    });
  });

  describe('dbGet', () => {
    test('should resolve with row on success', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, { id: 1 }));

      const result = await dbGet('SELECT * FROM test WHERE id = ?', [1]);
      expect(result).toEqual({ id: 1 });
    });

    test('should resolve with null when not found', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, null));

      const result = await dbGet('SELECT * FROM test WHERE id = ?', [99]);
      expect(result).toBeNull();
    });

    test('should reject on error', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(new Error('fail')));

      await expect(dbGet('SELECT * FROM test', [])).rejects.toThrow('fail');
    });
  });

  describe('dbRun', () => {
    test('should resolve with lastID and changes on success', async () => {
      mockDb.run.mockImplementation(function(q, p, cb) {
        cb.call({ lastID: 5, changes: 1 }, null);
      });

      const result = await dbRun('INSERT INTO test VALUES (?)', [1]);
      expect(result).toEqual({ lastID: 5, changes: 1 });
    });

    test('should reject on error', async () => {
      mockDb.run.mockImplementation(function(q, p, cb) {
        cb.call(this, new Error('fail'));
      });

      await expect(dbRun('INSERT INTO test VALUES (?)', [1])).rejects.toThrow('fail');
    });
  });

  describe('buildUpdateQuery', () => {
    test('should build query from defined fields', () => {
      const result = buildUpdateQuery('projects', { name: 'Test', status: 'active' }, 1, 'user@test.com');

      expect(result.query).toContain('UPDATE projects SET');
      expect(result.query).toContain('name = ?');
      expect(result.query).toContain('status = ?');
      expect(result.query).toContain('updated_at = CURRENT_TIMESTAMP');
      expect(result.query).toContain('WHERE id = ? AND user_email = ?');
      expect(result.values).toEqual(['Test', 'active', 1, 'user@test.com']);
    });

    test('should skip undefined fields', () => {
      const result = buildUpdateQuery('projects', { name: 'Test', status: undefined }, 1, 'user@test.com');

      expect(result.query).toContain('name = ?');
      expect(result.query).not.toContain('status = ?');
      expect(result.values).toEqual(['Test', 1, 'user@test.com']);
    });
  });
});
