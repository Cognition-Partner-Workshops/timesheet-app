// Use the real sqlite3 driver so Knex can run migrations against an
// actual in-memory database (the global mock from setup.js is bypassed here)
jest.unmock('sqlite3');

const { getKnex, getDatabase, initializeDatabase, closeDatabase } = require('../../database/init');

describe('Database Initialization', () => {
  let consoleLogSpy, consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(async () => {
    await closeDatabase();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('getDatabase', () => {
    test('should throw if called before initialization', () => {
      expect(() => getDatabase()).toThrow('Database not initialized');
    });

    test('should return raw sqlite3 connection after initialization', async () => {
      await initializeDatabase();
      const db = getDatabase();

      expect(db).toBeDefined();
      expect(typeof db.run).toBe('function');
      expect(typeof db.get).toBe('function');
      expect(typeof db.all).toBe('function');
    });

    test('should return same connection on multiple calls', async () => {
      await initializeDatabase();
      expect(getDatabase()).toBe(getDatabase());
    });
  });

  describe('initializeDatabase', () => {
    test('should use an in-memory database in the test environment', async () => {
      await initializeDatabase();
      expect(consoleLogSpy).toHaveBeenCalledWith('Connected to SQLite database (in-memory)');
    });

    test('should create all required tables via migrations', async () => {
      await initializeDatabase();
      const tables = await getKnex()
        .select('name')
        .from('sqlite_master')
        .where({ type: 'table' });
      const names = tables.map((t) => t.name);

      expect(names).toContain('users');
      expect(names).toContain('clients');
      expect(names).toContain('work_entries');
      expect(names).toContain('knex_migrations');
    });

    test('should create indexes for performance', async () => {
      await initializeDatabase();
      const indexes = await getKnex()
        .select('name')
        .from('sqlite_master')
        .where({ type: 'index' });
      const names = indexes.map((i) => i.name);

      expect(names).toContain('idx_clients_user_email');
      expect(names).toContain('idx_work_entries_client_id');
      expect(names).toContain('idx_work_entries_user_email');
      expect(names).toContain('idx_work_entries_date');
    });

    test('should be idempotent', async () => {
      await initializeDatabase();
      await expect(initializeDatabase()).resolves.toBeUndefined();
    });
  });

  describe('Database Schema', () => {
    test('clients table should have all expected columns', async () => {
      await initializeDatabase();
      const knex = getKnex();

      for (const column of ['id', 'name', 'description', 'department', 'email', 'user_email', 'created_at', 'updated_at']) {
        expect(await knex.schema.hasColumn('clients', column)).toBe(true);
      }
    });

    test('foreign keys should cascade deletes from users', async () => {
      await initializeDatabase();
      const knex = getKnex();

      await knex('users').insert({ email: 'fk@example.com' });
      const [clientId] = await knex('clients').insert({ name: 'Acme', user_email: 'fk@example.com' });
      await knex('work_entries').insert({
        client_id: clientId,
        user_email: 'fk@example.com',
        hours: 2.5,
        date: '2026-07-30'
      });

      await knex('users').where({ email: 'fk@example.com' }).del();

      expect(await knex('clients').count('* as n').first()).toEqual({ n: 0 });
      expect(await knex('work_entries').count('* as n').first()).toEqual({ n: 0 });
    });
  });

  describe('closeDatabase', () => {
    test('should close database connection', async () => {
      await initializeDatabase();
      await closeDatabase();

      expect(consoleLogSpy).toHaveBeenCalledWith('Database connection closed');
      expect(() => getDatabase()).toThrow('Database not initialized');
    });

    test('should handle multiple close calls safely', async () => {
      await initializeDatabase();
      await closeDatabase();
      await expect(closeDatabase()).resolves.toBeUndefined();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('should resolve when never initialized', async () => {
      await expect(closeDatabase()).resolves.toBeUndefined();
    });
  });
});
