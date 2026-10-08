jest.unmock('sqlite3');

const sqlite3 = jest.requireActual('sqlite3').verbose();
const { migrations, runMigrations, run, get, all } = require('../../database/migrations');

function openMemoryDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(':memory:', (err) => (err ? reject(err) : resolve(db)));
  });
}

function closeDb(db) {
  return new Promise((resolve) => db.close(() => resolve()));
}

describe('Database initialization', () => {
  let consoleLogSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.resetModules();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    delete process.env.DATABASE_PATH;
  });

  test('resolveDatabasePath honours DATABASE_PATH, then test env, then file default', () => {
    const { resolveDatabasePath } = require('../../database/init');
    process.env.DATABASE_PATH = '/tmp/custom.db';
    expect(resolveDatabasePath()).toBe('/tmp/custom.db');
    delete process.env.DATABASE_PATH;
    expect(resolveDatabasePath()).toBe(':memory:');

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(resolveDatabasePath()).toMatch(/data[\\/]timesheet\.db$/);
    process.env.NODE_ENV = originalEnv;
  });

  test('initializeDatabase enables foreign keys and applies all migrations', async () => {
    const { getDatabase, initializeDatabase, closeDatabase } = require('../../database/init');
    await initializeDatabase();
    const db = getDatabase();

    expect((await get(db, 'PRAGMA foreign_keys')).foreign_keys).toBe(1);
    expect((await get(db, 'PRAGMA user_version')).user_version).toBe(migrations.length);
    const tables = (await all(db, "SELECT name FROM sqlite_master WHERE type = 'table'")).map((t) => t.name);
    expect(tables).toEqual(expect.arrayContaining(['users', 'clients', 'work_entries']));
    expect(consoleLogSpy).toHaveBeenCalledWith('Database tables created successfully');

    await closeDatabase();
    await closeDatabase();
  });

  test('getDatabase returns the same instance', () => {
    const { getDatabase, closeDatabase } = require('../../database/init');
    expect(getDatabase()).toBe(getDatabase());
    return closeDatabase();
  });
});

describe('Migrations', () => {
  let db;

  beforeEach(async () => {
    db = await openMemoryDb();
  });

  afterEach(async () => {
    await closeDb(db);
  });

  test('are idempotent', async () => {
    await runMigrations(db);
    await runMigrations(db);
    expect((await get(db, 'PRAGMA user_version')).user_version).toBe(migrations.length);
  });

  test('upgrade a database created by the old docker schema without losing data', async () => {
    await run(db, 'CREATE TABLE users (email TEXT PRIMARY KEY, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    await run(db, `CREATE TABLE clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT,
      user_email TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await run(db, `CREATE TABLE work_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL,
      user_email TEXT NOT NULL, hours DECIMAL(5,2) NOT NULL, description TEXT, date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await run(db, "INSERT INTO users (email) VALUES ('a@example.com')");
    await run(db, "INSERT INTO clients (name, user_email) VALUES ('Acme', 'a@example.com')");
    await run(db, "INSERT INTO work_entries (client_id, user_email, hours, date) VALUES (1, 'a@example.com', 2, ?)", [Date.UTC(2026, 5, 24)]);
    await run(db, "INSERT INTO work_entries (client_id, user_email, hours, date) VALUES (1, 'a@example.com', 3, '2026-06-25T00:00:00.000Z')");
    await run(db, "INSERT INTO work_entries (client_id, user_email, hours, date) VALUES (1, 'a@example.com', 4, '2026-06-26')");

    await runMigrations(db);

    const columns = (await all(db, 'PRAGMA table_info(clients)')).map((c) => c.name);
    expect(columns).toEqual(expect.arrayContaining(['department', 'email']));
    const dates = (await all(db, 'SELECT date, typeof(date) AS t FROM work_entries ORDER BY id'));
    expect(dates.map((d) => d.date)).toEqual(['2026-06-24', '2026-06-25', '2026-06-26']);
    expect(dates.every((d) => d.t === 'text')).toBe(true);
    expect((await get(db, 'SELECT COUNT(*) AS n FROM clients')).n).toBe(1);
  });

  test('roll back a failing migration and leave user_version unchanged', async () => {
    const failing = [
      async (conn) => run(conn, 'CREATE TABLE ok_table (id INTEGER)'),
      async (conn) => {
        await run(conn, 'CREATE TABLE partial (id INTEGER)');
        throw new Error('boom');
      },
    ];
    await expect(runMigrations(db, failing)).rejects.toThrow('boom');
    expect((await get(db, 'PRAGMA user_version')).user_version).toBe(1);
    const tables = (await all(db, "SELECT name FROM sqlite_master WHERE type = 'table'")).map((t) => t.name);
    expect(tables).toContain('ok_table');
    expect(tables).not.toContain('partial');
  });
});
