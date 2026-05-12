describe('Database Initialization - Coverage Improvement', () => {
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

  describe('closeDatabase - edge cases', () => {
    test('should resolve immediately when db is null', async () => {
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

      const { closeDatabase } = require('../../database/init');

      // closeDatabase without ever calling getDatabase: db is null
      await expect(closeDatabase()).resolves.toBeUndefined();
    });

    test('should handle concurrent close calls (isClosing branch)', async () => {
      let closeCallback = null;
      const mockDatabase = {
        serialize: jest.fn((cb) => cb()),
        run: jest.fn((q, cb) => { if (typeof cb === 'function') cb(null); }),
        close: jest.fn((cb) => {
          // Don't call callback immediately to simulate slow close
          closeCallback = cb;
        })
      };

      jest.doMock('sqlite3', () => {
        return {
          verbose: jest.fn(() => ({
            Database: jest.fn((path, callback) => {
              callback(null);
              return mockDatabase;
            })
          }))
        };
      });

      const { getDatabase, closeDatabase } = require('../../database/init');

      // Initialize the database
      getDatabase();

      // Start first close - this will set isClosing = true
      const firstClose = closeDatabase();

      // Start second close while first is still in progress (isClosing = true)
      const secondClose = closeDatabase();

      // Now complete the first close
      if (closeCallback) {
        closeCallback(null);
      }

      await firstClose;
      await secondClose;
    });

    test('should handle calling closeDatabase after already closed (isClosed branch)', async () => {
      const mockDatabase = {
        serialize: jest.fn((cb) => cb()),
        run: jest.fn((q, cb) => { if (typeof cb === 'function') cb(null); }),
        close: jest.fn((cb) => cb(null))
      };

      jest.doMock('sqlite3', () => {
        return {
          verbose: jest.fn(() => ({
            Database: jest.fn((path, callback) => {
              callback(null);
              return mockDatabase;
            })
          }))
        };
      });

      const { getDatabase, closeDatabase } = require('../../database/init');

      // Initialize and close
      getDatabase();
      await closeDatabase();

      // Call close again when isClosed is true
      await expect(closeDatabase()).resolves.toBeUndefined();
    });

    test('should reset state and allow new connection after close', async () => {
      const mockDatabase = {
        serialize: jest.fn((cb) => cb()),
        run: jest.fn((q, cb) => { if (typeof cb === 'function') cb(null); }),
        close: jest.fn((cb) => cb(null))
      };

      jest.doMock('sqlite3', () => {
        return {
          verbose: jest.fn(() => ({
            Database: jest.fn((path, callback) => {
              callback(null);
              return mockDatabase;
            })
          }))
        };
      });

      const { getDatabase, closeDatabase } = require('../../database/init');

      const db1 = getDatabase();
      await closeDatabase();

      // After close, getting database should create a new connection
      const db2 = getDatabase();
      expect(db2).toBeDefined();
    });

    test('should handle close error without rejecting the promise', async () => {
      const mockDatabase = {
        serialize: jest.fn((cb) => cb()),
        run: jest.fn((q, cb) => { if (typeof cb === 'function') cb(null); }),
        close: jest.fn((cb) => cb(new Error('Close failed')))
      };

      jest.doMock('sqlite3', () => {
        return {
          verbose: jest.fn(() => ({
            Database: jest.fn((path, callback) => {
              callback(null);
              return mockDatabase;
            })
          }))
        };
      });

      const { getDatabase, closeDatabase } = require('../../database/init');

      getDatabase();
      await expect(closeDatabase()).resolves.toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error closing database:', expect.any(Error));
    });
  });

  describe('initializeDatabase - edge cases', () => {
    test('should use in-memory database path', () => {
      jest.doMock('sqlite3', () => {
        const DatabaseConstructor = jest.fn((path, callback) => {
          callback(null);
          return {
            serialize: jest.fn((cb) => cb()),
            run: jest.fn((q, cb) => { if (typeof cb === 'function') cb(null); }),
            close: jest.fn((cb) => cb(null))
          };
        });

        return {
          verbose: jest.fn(() => ({
            Database: DatabaseConstructor
          }))
        };
      });

      const { getDatabase } = require('../../database/init');
      getDatabase();

      const sqlite3 = require('sqlite3');
      const Database = sqlite3.verbose().Database;
      expect(Database).toHaveBeenCalledWith(':memory:', expect.any(Function));
    });
  });
});
