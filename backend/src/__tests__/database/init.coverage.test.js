const { getDatabase, initializeDatabase, closeDatabase } = require('../../database/init');

describe('Database Init - Coverage Gaps', () => {
  afterEach(async () => {
    await closeDatabase();
  });

  describe('closeDatabase edge cases', () => {
    test('should resolve immediately when no database connection exists', async () => {
      // Ensure db is null by closing any existing connection
      await closeDatabase();

      // Call close again when db is already null
      await expect(closeDatabase()).resolves.toBeUndefined();
    });

    test('should resolve when already closed', async () => {
      getDatabase();
      await closeDatabase();

      // Call close again when already closed (isClosed === true)
      await expect(closeDatabase()).resolves.toBeUndefined();
    });

    test('should handle concurrent close calls via isClosing branch', async () => {
      // Get a reference to the mock db so we can control close timing
      const db = getDatabase();

      // Override close to be async so isClosing stays true long enough
      const originalClose = db.close;
      let closeCallback = null;
      db.close = jest.fn((callback) => {
        closeCallback = callback;
        // Don't call callback yet - simulates slow close
      });

      // Start first close - sets isClosing = true
      const close1 = closeDatabase();

      // Start second close while first is still in progress (isClosing === true)
      // This should enter the setInterval branch (lines 91-97)
      const close2 = closeDatabase();

      // Now complete the first close by calling the callback
      // This sets isClosed = true, which lets the setInterval in close2 resolve
      closeCallback(null);

      // Both should resolve
      await close1;
      await close2;
    });

    test('should handle close error gracefully', async () => {
      const db = getDatabase();

      // Override close to call back with error
      db.close = jest.fn((callback) => {
        callback(new Error('Close error'));
      });

      // Should resolve despite error
      await expect(closeDatabase()).resolves.toBeUndefined();
    });

    test('should reset state after close and allow new connection', async () => {
      const db1 = getDatabase();
      expect(db1).toBeTruthy();
      await closeDatabase();

      const db2 = getDatabase();
      expect(db2).toBeTruthy();
    });
  });

  describe('getDatabase', () => {
    test('should return the same instance when called multiple times', () => {
      const db1 = getDatabase();
      const db2 = getDatabase();
      expect(db1).toBe(db2);
    });

    test('should create new instance after close', async () => {
      const db1 = getDatabase();
      await closeDatabase();
      const db2 = getDatabase();
      expect(db2).toBeTruthy();
    });
  });

  describe('initializeDatabase', () => {
    test('should create tables without error', async () => {
      await expect(initializeDatabase()).resolves.toBeUndefined();
    });

    test('should be idempotent (safe to call multiple times)', async () => {
      await initializeDatabase();
      await expect(initializeDatabase()).resolves.toBeUndefined();
    });
  });
});
