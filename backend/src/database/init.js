const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('node:fs');
const { runMigrations, run } = require('./migrations');

let db = null;
let isClosing = false;
let isClosed = false;

function resolveDatabasePath() {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  if (process.env.NODE_ENV === 'test') {
    return ':memory:';
  }
  return path.join(__dirname, '../../data/timesheet.db');
}

function getDatabase() {
  if (!db) {
    // Reset state when creating a new database connection
    isClosing = false;
    isClosed = false;

    const dbPath = resolveDatabasePath();
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        throw err;
      }
      const label = dbPath === ':memory:' ? 'in-memory' : `file: ${dbPath}`;
      console.log(`Connected to SQLite database (${label})`);
    });
  }
  return db;
}

async function initializeDatabase() {
  const database = getDatabase();
  await run(database, 'PRAGMA foreign_keys = ON');
  await runMigrations(database);
  console.log('Database tables created successfully');
}

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
  resolveDatabasePath,
  initializeDatabase,
  closeDatabase
};
