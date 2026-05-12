const { getDatabase, initializeDatabase, closeDatabase } = require('../../database/init');

function createSqlite3Mock(overrides = {}) {
  const defaultDb = {
    serialize: jest.fn((cb) => cb()),
    run: jest.fn((q, cb) => { if (typeof cb === 'function') cb(null); }),
    close: jest.fn((cb) => cb(null)),
    ...overrides
  };
  return {
    verbose: jest.fn(() => ({
      Database: jest.fn((path, callback) => {
        callback(null);
        return defaultDb;
      })
    }))
  };
}

describe('Database Initialization - Coverage Gaps', () => {
  let consoleLogSpy, consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    jest.resetModules();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('closeDatabase - isClosing path', () => {
    test('should wait and resolve when another close is in progress', async () => {
      let closeCallback = null;
      jest.doMock('sqlite3', () => createSqlite3Mock({
        close: jest.fn((cb) => {
          closeCallback = cb;
          setTimeout(() => { if (closeCallback) closeCallback(null); }, 50);
        })
      }));

      const { getDatabase: getDb, closeDatabase: closeDb } = require('../../database/init');
      getDb();

      const firstClose = closeDb();
      const secondClose = closeDb();
      await Promise.all([firstClose, secondClose]);
    });
  });

  describe('closeDatabase - no database connection', () => {
    test('should resolve immediately when no database connection exists', async () => {
      jest.doMock('sqlite3', () => createSqlite3Mock());

      const { closeDatabase: closeDb } = require('../../database/init');
      await expect(closeDb()).resolves.toBeUndefined();
    });
  });

  describe('closeDatabase - already closed', () => {
    test('should resolve immediately when database is already closed', async () => {
      jest.doMock('sqlite3', () => createSqlite3Mock());

      const { getDatabase: getDb, closeDatabase: closeDb } = require('../../database/init');
      getDb();
      await closeDb();
      await expect(closeDb()).resolves.toBeUndefined();
    });
  });

  describe('getDatabase - singleton reset after close', () => {
    test('should create new connection after previous was closed', async () => {
      jest.doMock('sqlite3', () => createSqlite3Mock());

      const { getDatabase: getDb, closeDatabase: closeDb } = require('../../database/init');
      getDb();
      await closeDb();

      const db2 = getDb();
      expect(db2).toBeDefined();
    });
  });
});
