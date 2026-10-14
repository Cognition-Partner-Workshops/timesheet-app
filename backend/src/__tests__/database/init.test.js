const mysql = require('mysql2');
const { getDatabase, initializeDatabase, closeDatabase } = require('../../database/init');

// Mock mysql2
jest.mock('mysql2', () => {
  const mockPromisePool = {
    query: jest.fn().mockResolvedValue([[], []])
  };

  const mockPool = {
    query: jest.fn((query, params, callback) => {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      if (typeof callback === 'function') {
        callback(null, []);
      }
    }),
    promise: jest.fn(() => mockPromisePool),
    end: jest.fn((callback) => callback && callback(null))
  };

  return {
    createPool: jest.fn(() => mockPool)
  };
});

describe('Database Initialization', () => {
  let consoleLogSpy, consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Reset the database singleton
    jest.resetModules();
  });

  afterEach(async () => {
    await closeDatabase();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('getDatabase', () => {
    test('should create and return database wrapper', () => {
      const db = getDatabase();

      expect(db).toBeDefined();
      expect(db.get).toBeDefined();
      expect(db.all).toBeDefined();
      expect(db.run).toBeDefined();
      expect(db.serialize).toBeDefined();
      expect(consoleLogSpy).toHaveBeenCalledWith('Connected to MySQL database');
    });

    test('should return same database instance on multiple calls', () => {
      const db1 = getDatabase();
      const db2 = getDatabase();

      expect(db1).toBe(db2);
    });

    test('should create pool with default config', () => {
      getDatabase();

      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 3306,
          user: 'root',
          database: 'timesheet'
        })
      );
    });
  });

  describe('initializeDatabase', () => {
    test('should create all required tables', async () => {
      await initializeDatabase();
      const db = getDatabase();

      const mockPromisePool = mysql.createPool().promise();
      const queryCalls = mockPromisePool.query.mock.calls;
      const queries = queryCalls.map(call => call[0]);

      expect(queries.some(q => q.includes('CREATE TABLE IF NOT EXISTS users'))).toBe(true);
      expect(queries.some(q => q.includes('CREATE TABLE IF NOT EXISTS clients'))).toBe(true);
      expect(queries.some(q => q.includes('CREATE TABLE IF NOT EXISTS work_entries'))).toBe(true);
    });

    test('should create indexes for performance', async () => {
      await initializeDatabase();

      const mockPromisePool = mysql.createPool().promise();
      const queryCalls = mockPromisePool.query.mock.calls;
      const queries = queryCalls.map(call => call[0]);

      expect(queries.some(q => q.includes('idx_clients_user_email'))).toBe(true);
      expect(queries.some(q => q.includes('idx_work_entries_client_id'))).toBe(true);
      expect(queries.some(q => q.includes('idx_work_entries_user_email'))).toBe(true);
      expect(queries.some(q => q.includes('idx_work_entries_date'))).toBe(true);
    });

    test('should log success message', async () => {
      await initializeDatabase();

      expect(consoleLogSpy).toHaveBeenCalledWith('Database tables created successfully');
    });

    test('should resolve promise on success', async () => {
      await expect(initializeDatabase()).resolves.toBeUndefined();
    });
  });

  describe('closeDatabase', () => {
    test('should close database connection pool', async () => {
      getDatabase();
      await closeDatabase();

      const mockPool = mysql.createPool();
      expect(mockPool.end).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Database connection closed');
    });

    test('should handle close error gracefully', async () => {
      getDatabase();

      const mockPool = mysql.createPool();
      mockPool.end.mockImplementation((callback) => callback(new Error('Close error')));

      await closeDatabase();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error closing database:', expect.any(Error));
    });

    test('should handle close when no pool exists', async () => {
      // Don't call getDatabase, so pool is null after previous closeDatabase
      await closeDatabase();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Database Schema', () => {
    test('users table should use VARCHAR for email primary key', async () => {
      await initializeDatabase();

      const mockPromisePool = mysql.createPool().promise();
      const usersQuery = mockPromisePool.query.mock.calls.find(call =>
        call[0].includes('CREATE TABLE IF NOT EXISTS users')
      );

      expect(usersQuery).toBeDefined();
      expect(usersQuery[0]).toContain('email VARCHAR(255) PRIMARY KEY');
      expect(usersQuery[0]).toContain('created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    });

    test('clients table should have foreign key to users', async () => {
      await initializeDatabase();

      const mockPromisePool = mysql.createPool().promise();
      const clientsQuery = mockPromisePool.query.mock.calls.find(call =>
        call[0].includes('CREATE TABLE IF NOT EXISTS clients')
      );

      expect(clientsQuery).toBeDefined();
      expect(clientsQuery[0]).toContain('user_email VARCHAR(255) NOT NULL');
      expect(clientsQuery[0]).toContain('FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE');
    });

    test('work_entries table should have foreign keys', async () => {
      await initializeDatabase();

      const mockPromisePool = mysql.createPool().promise();
      const workEntriesQuery = mockPromisePool.query.mock.calls.find(call =>
        call[0].includes('CREATE TABLE IF NOT EXISTS work_entries')
      );

      expect(workEntriesQuery).toBeDefined();
      expect(workEntriesQuery[0]).toContain('FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE');
      expect(workEntriesQuery[0]).toContain('FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE');
    });
  });
});
