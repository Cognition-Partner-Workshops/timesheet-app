// Override sqlite3 mock for this test file to allow delayed close
jest.mock('sqlite3', () => {
  let closeCallback = null;
  let closeDelay = 0;

  const mockDatabase = {
    serialize: jest.fn((callback) => callback()),
    run: jest.fn((query, paramsOrCallback, callback) => {
      const cb = typeof paramsOrCallback === 'function' ? paramsOrCallback : callback;
      if (typeof cb === 'function') cb(null);
    }),
    get: jest.fn(),
    all: jest.fn(),
    close: jest.fn((callback) => {
      if (closeDelay > 0) {
        setTimeout(() => {
          if (callback) callback(null);
        }, closeDelay);
      } else {
        if (callback) callback(null);
      }
    }),
    _setCloseDelay: (delay) => { closeDelay = delay; },
    _getCloseDelay: () => closeDelay
  };

  return {
    verbose: jest.fn(() => ({
      Database: jest.fn((path, callback) => {
        if (callback) callback(null);
        return mockDatabase;
      })
    })),
    _mockDb: mockDatabase
  };
});

const { closeDatabase, getDatabase, initializeDatabase } = require('../../database/init');

describe('Database Init - Extended Coverage', () => {
  beforeEach(async () => {
    await initializeDatabase();
  });

  afterEach(async () => {
    // Reset close delay
    const sqlite3 = require('sqlite3');
    sqlite3._mockDb._setCloseDelay(0);
    await closeDatabase();
  });

  describe('closeDatabase', () => {
    test('should resolve immediately when already closed', async () => {
      await closeDatabase();
      // Second close - isClosed is true, should resolve immediately
      await closeDatabase();
    });

    test('should handle concurrent close calls (isClosing state)', async () => {
      const sqlite3 = require('sqlite3');
      // Add delay to close to create the isClosing window
      sqlite3._mockDb._setCloseDelay(50);

      // Start two close operations simultaneously
      const close1 = closeDatabase();
      // Small delay to ensure first call sets isClosing
      await new Promise(resolve => setTimeout(resolve, 5));
      const close2 = closeDatabase();

      await Promise.all([close1, close2]);
    });

    test('should resolve when db is null', async () => {
      // Close to set db=null
      await closeDatabase();
      // getDatabase creates new connection, close again, then close with null
      await closeDatabase();
    });

    test('should handle close error gracefully', async () => {
      const sqlite3 = require('sqlite3');
      sqlite3._mockDb.close.mockImplementationOnce((callback) => {
        if (callback) callback(new Error('Close error'));
      });

      // Should not throw
      await closeDatabase();
    });
  });

  describe('getDatabase', () => {
    test('should create a new database when called after close', async () => {
      await closeDatabase();
      const db = getDatabase();
      expect(db).toBeDefined();
    });

    test('should return the same database instance on subsequent calls', () => {
      const db1 = getDatabase();
      const db2 = getDatabase();
      expect(db1).toBe(db2);
    });
  });

  describe('initializeDatabase', () => {
    test('should create tables and indexes successfully', async () => {
      await closeDatabase();
      await initializeDatabase();
      const db = getDatabase();
      expect(db).toBeDefined();
      expect(db.serialize).toHaveBeenCalled();
    });
  });
});
