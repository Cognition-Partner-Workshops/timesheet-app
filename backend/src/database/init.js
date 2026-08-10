const sqlite3 = require('sqlite3').verbose();

let db = null;
let isClosing = false;
let isClosed = false;

/**
 * Returns the shared SQLite connection, creating an in-memory database
 * on first use. Subsequent calls return the same instance.
 * @returns {import('sqlite3').Database} the singleton database connection
 */
function getDatabase() {
  if (!db) {
    // Reset state when creating a new database connection
    isClosing = false;
    isClosed = false;
    // Use in-memory database as specified in requirements
    db = new sqlite3.Database(':memory:', (err) => {
      if (err) {
        console.error('Error opening database:', err);
        throw err;
      }
      console.log('Connected to SQLite in-memory database');
    });
  }
  return db;
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    department TEXT,
    email TEXT,
    user_email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS work_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    user_email TEXT NOT NULL,
    hours DECIMAL(5,2) NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
    FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE
  )`,
  // Indexes for common lookup patterns (per-user filtering and date ranges)
  `CREATE INDEX IF NOT EXISTS idx_clients_user_email ON clients (user_email)`,
  `CREATE INDEX IF NOT EXISTS idx_work_entries_client_id ON work_entries (client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_work_entries_user_email ON work_entries (user_email)`,
  `CREATE INDEX IF NOT EXISTS idx_work_entries_date ON work_entries (date)`
];

/**
 * Creates all tables and indexes if they do not already exist.
 * Rejects if any schema statement fails, so callers can abort startup.
 * @returns {Promise<void>}
 */
async function initializeDatabase() {
  const database = getDatabase();

  return new Promise((resolve, reject) => {
    database.serialize(() => {
      let failed = false;
      let remaining = SCHEMA_STATEMENTS.length;

      SCHEMA_STATEMENTS.forEach((statement) => {
        database.run(statement, (err) => {
          if (failed) {
            return;
          }
          if (err) {
            failed = true;
            console.error('Error creating database schema:', err);
            reject(err);
            return;
          }
          remaining -= 1;
          if (remaining === 0) {
            console.log('Database tables created successfully');
            resolve();
          }
        });
      });
    });
  });
}

/**
 * Closes the shared connection, tolerating concurrent and repeated calls.
 * Always resolves; close errors are logged rather than thrown.
 * @returns {Promise<void>}
 */
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (isClosed) {
      // Already closed, resolve immediately
      resolve();
      return;
    }
    
    if (isClosing) {
      // Currently closing, wait for it to complete
      const checkClosed = setInterval(() => {
        if (isClosed) {
          clearInterval(checkClosed);
          resolve();
        }
      }, 10);
      return;
    }
    
    if (!db) {
      // No database connection, resolve immediately
      resolve();
      return;
    }
    
    isClosing = true;
    db.close((err) => {
      isClosed = true;
      isClosing = false;
      db = null;
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
      resolve();
    });
  });
}

module.exports = {
  getDatabase,
  initializeDatabase,
  closeDatabase
};
