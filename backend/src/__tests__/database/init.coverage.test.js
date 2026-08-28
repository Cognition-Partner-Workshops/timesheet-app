describe('Database - closeDatabase Coverage', () => {
  let consoleLogSpy, consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test('should resolve immediately when db is already closed (isClosed=true)', async () => {
    jest.resetModules();

    // Create a mock where close sets isClosed = true
    const mockDatabase = {
      serialize: jest.fn((callback) => callback()),
      run: jest.fn((query, callback) => {
        if (typeof callback === 'function') callback(null);
      }),
      close: jest.fn((callback) => callback(null))
    };

    jest.doMock('sqlite3', () => ({
      verbose: jest.fn(() => ({
        Database: jest.fn((path, callback) => {
          callback(null);
          return mockDatabase;
        })
      }))
    }));

    const { getDatabase, closeDatabase } = require('../../database/init');

    // First call: create db and close it
    getDatabase();
    await closeDatabase();

    // Second call: db is already closed, should resolve immediately
    await expect(closeDatabase()).resolves.toBeUndefined();
  });

  test('should resolve when no database connection exists', async () => {
    jest.resetModules();

    const mockDatabase = {
      serialize: jest.fn((callback) => callback()),
      run: jest.fn((query, callback) => {
        if (typeof callback === 'function') callback(null);
      }),
      close: jest.fn((callback) => callback(null))
    };

    jest.doMock('sqlite3', () => ({
      verbose: jest.fn(() => ({
        Database: jest.fn((path, callback) => {
          callback(null);
          return mockDatabase;
        })
      }))
    }));

    const { closeDatabase } = require('../../database/init');

    // Call closeDatabase without ever calling getDatabase
    await expect(closeDatabase()).resolves.toBeUndefined();
  });

  test('should wait when database is currently closing (isClosing=true)', async () => {
    jest.resetModules();

    let closeCallback;
    const mockDatabase = {
      serialize: jest.fn((callback) => callback()),
      run: jest.fn((query, callback) => {
        if (typeof callback === 'function') callback(null);
      }),
      close: jest.fn((cb) => {
        // Store callback to call later, simulating a slow close
        closeCallback = cb;
      })
    };

    jest.doMock('sqlite3', () => ({
      verbose: jest.fn(() => ({
        Database: jest.fn((path, callback) => {
          callback(null);
          return mockDatabase;
        })
      }))
    }));

    const { getDatabase, closeDatabase } = require('../../database/init');

    getDatabase();

    // Start first close (will be pending because we don't call closeCallback yet)
    const firstClose = closeDatabase();

    // Start second close (should wait for first to finish via isClosing check)
    const secondClose = closeDatabase();

    // Complete the first close
    closeCallback(null);

    // Both should resolve
    await expect(firstClose).resolves.toBeUndefined();
    await expect(secondClose).resolves.toBeUndefined();
  });

  test('should handle close error but still resolve', async () => {
    jest.resetModules();

    const mockDatabase = {
      serialize: jest.fn((callback) => callback()),
      run: jest.fn((query, callback) => {
        if (typeof callback === 'function') callback(null);
      }),
      close: jest.fn((callback) => callback(new Error('Close failed')))
    };

    jest.doMock('sqlite3', () => ({
      verbose: jest.fn(() => ({
        Database: jest.fn((path, callback) => {
          callback(null);
          return mockDatabase;
        })
      }))
    }));

    const { getDatabase, closeDatabase } = require('../../database/init');

    getDatabase();
    await closeDatabase();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error closing database:', expect.any(Error));
  });

  test('should reset db to null after close and allow new connection', async () => {
    jest.resetModules();

    const mockDatabase = {
      serialize: jest.fn((callback) => callback()),
      run: jest.fn((query, callback) => {
        if (typeof callback === 'function') callback(null);
      }),
      close: jest.fn((callback) => callback(null))
    };

    jest.doMock('sqlite3', () => ({
      verbose: jest.fn(() => ({
        Database: jest.fn((path, callback) => {
          callback(null);
          return mockDatabase;
        })
      }))
    }));

    const { getDatabase, closeDatabase } = require('../../database/init');

    const db1 = getDatabase();
    await closeDatabase();

    // After close, getDatabase should create a new connection
    const db2 = getDatabase();
    expect(db2).toBeDefined();
  });
});
