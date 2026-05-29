const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { applySchema } = require('./schema');

let db = null;
let isClosing = false;
let isClosed = false;

function getDatabase() {
  if (!db) {
    isClosing = false;
    isClosed = false;
    const dbPath = process.env.DATABASE_PATH || ':memory:';
    
    if (dbPath !== ':memory:') {
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    }
    
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        throw err;
      }
      const dbType = dbPath === ':memory:' ? 'in-memory' : `file: ${dbPath}`;
      console.log(`Connected to SQLite database (${dbType})`);
    });
  }
  return db;
}

async function initializeDatabase() {
  const database = getDatabase();
  
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      applySchema(database);
      console.log('Database tables created successfully');
      resolve();
    });
  });
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (isClosed) {
      resolve();
      return;
    }
    
    if (isClosing) {
      const checkClosed = setInterval(() => {
        if (isClosed) {
          clearInterval(checkClosed);
          resolve();
        }
      }, 10);
      return;
    }
    
    if (!db) {
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
