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

  function createMockDatabase(closeOverride) {
    return {
      serialize: jest.fn((cb) => cb()),
      run: jest.fn((q, cb) => { if (typeof cb === 'function') cb(null); }),
      close: closeOverride || jest.fn((cb) => cb(null))
    };
  }

  function mockSqlite3(mockDatabase) {
    jest.doMock('sqlite3', () => ({
      verbose: jest.fn(() => ({
        Database: jest.fn((path, callback) => {
          callback(null);
          return mockDatabase;
        })
      }))
    }));
  }

  function setupDbModule(mockDatabase) {
    mockSqlite3(mockDatabase);
    return require('../../database/init');
  }

  describe('closeDatabase - edge cases', () => {
    test('should resolve immediately when db is null', async () => {
      const { closeDatabase } = setupDbModule(createMockDatabase());
      await expect(closeDatabase()).resolves.toBeUndefined();
    });

    test('should handle concurrent close calls (isClosing branch)', async () => {
      let closeCallback = null;
      const mockDb = createMockDatabase(jest.fn((cb) => { closeCallback = cb; }));
      const { getDatabase, closeDatabase } = setupDbModule(mockDb);

      getDatabase();
      const firstClose = closeDatabase();
      const secondClose = closeDatabase();

      if (closeCallback) closeCallback(null);
      await firstClose;
      await secondClose;
    });

    test('should handle calling closeDatabase after already closed (isClosed branch)', async () => {
      const { getDatabase, closeDatabase } = setupDbModule(createMockDatabase());
      getDatabase();
      await closeDatabase();
      await expect(closeDatabase()).resolves.toBeUndefined();
    });

    test('should reset state and allow new connection after close', async () => {
      const { getDatabase, closeDatabase } = setupDbModule(createMockDatabase());
      getDatabase();
      await closeDatabase();
      expect(getDatabase()).toBeDefined();
    });

    test('should handle close error without rejecting the promise', async () => {
      const mockDb = createMockDatabase(jest.fn((cb) => cb(new Error('Close failed'))));
      const { getDatabase, closeDatabase } = setupDbModule(mockDb);
      getDatabase();
      await expect(closeDatabase()).resolves.toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error closing database:', expect.any(Error));
    });
  });

  describe('initializeDatabase - edge cases', () => {
    test('should use in-memory database path', () => {
      const mockDb = createMockDatabase();
      const DatabaseConstructor = jest.fn((path, callback) => {
        callback(null);
        return mockDb;
      });
      jest.doMock('sqlite3', () => ({
        verbose: jest.fn(() => ({ Database: DatabaseConstructor }))
      }));
      const { getDatabase } = require('../../database/init');
      getDatabase();
      expect(DatabaseConstructor).toHaveBeenCalledWith(':memory:', expect.any(Function));
    });
  });
});
