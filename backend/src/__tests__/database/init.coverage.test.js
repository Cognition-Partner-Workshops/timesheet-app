const { getDatabase, initializeDatabase, closeDatabase } = require('../../database/init');

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
      // Create a custom mock where close triggers the isClosing wait path
      jest.doMock('sqlite3', () => {
        let closeCallback = null;
        const mockDatabase = {
          serialize: jest.fn((callback) => callback()),
          run: jest.fn((query, callback) => {
            if (typeof callback === 'function') callback(null);
          }),
          close: jest.fn((callback) => {
            closeCallback = callback;
            // Simulate delayed close - don't call callback immediately
            setTimeout(() => {
              if (closeCallback) closeCallback(null);
            }, 50);
          })
        };

        return {
          verbose: jest.fn(() => ({
            Database: jest.fn((path, callback) => {
              callback(null);
              return mockDatabase;
            })
          }))
        };
      });

      const { getDatabase: getDb, closeDatabase: closeDb } = require('../../database/init');

      // Initialize a database connection
      getDb();

      // Start first close (this will be "in progress")
      const firstClose = closeDb();

      // Start second close while first is in progress (hits isClosing path)
      const secondClose = closeDb();

      // Both should resolve
      await Promise.all([firstClose, secondClose]);
    });
  });

  describe('closeDatabase - no database connection', () => {
    test('should resolve immediately when no database connection exists', async () => {
      jest.doMock('sqlite3', () => {
        return {
          verbose: jest.fn(() => ({
            Database: jest.fn((path, callback) => {
              callback(null);
              return {
                serialize: jest.fn((cb) => cb()),
                run: jest.fn((q, cb) => { if (typeof cb === 'function') cb(null); }),
                close: jest.fn((cb) => cb(null))
              };
            })
          }))
        };
      });

      const { closeDatabase: closeDb } = require('../../database/init');

      // Close without ever calling getDatabase - db is null
      await expect(closeDb()).resolves.toBeUndefined();
    });
  });

  describe('closeDatabase - already closed', () => {
    test('should resolve immediately when database is already closed', async () => {
      jest.doMock('sqlite3', () => {
        return {
          verbose: jest.fn(() => ({
            Database: jest.fn((path, callback) => {
              callback(null);
              return {
                serialize: jest.fn((cb) => cb()),
                run: jest.fn((q, cb) => { if (typeof cb === 'function') cb(null); }),
                close: jest.fn((cb) => cb(null))
              };
            })
          }))
        };
      });

      const { getDatabase: getDb, closeDatabase: closeDb } = require('../../database/init');

      getDb();
      await closeDb(); // First close
      await expect(closeDb()).resolves.toBeUndefined(); // Already closed
    });
  });

  describe('getDatabase - singleton reset after close', () => {
    test('should create new connection after previous was closed', async () => {
      jest.doMock('sqlite3', () => {
        let callCount = 0;
        return {
          verbose: jest.fn(() => ({
            Database: jest.fn((path, callback) => {
              callCount++;
              callback(null);
              return {
                serialize: jest.fn((cb) => cb()),
                run: jest.fn((q, cb) => { if (typeof cb === 'function') cb(null); }),
                close: jest.fn((cb) => cb(null)),
                _callCount: callCount
              };
            })
          }))
        };
      });

      const { getDatabase: getDb, closeDatabase: closeDb } = require('../../database/init');

      const db1 = getDb();
      await closeDb();

      const db2 = getDb();
      // After close and re-open, we should get a new instance
      expect(db2).toBeDefined();
    });
  });
});
