const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db = null;
let isClosing = false;
let isClosed = false;

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

function runCreateTable(database, name, columns, constraints) {
  const parts = constraints ? [...columns, ...constraints] : columns;
  database.run(`CREATE TABLE IF NOT EXISTS ${name} (${parts.join(', ')})`);
}

const TIMESTAMPS = ['created_at DATETIME DEFAULT CURRENT_TIMESTAMP', 'updated_at DATETIME DEFAULT CURRENT_TIMESTAMP'];
const userEmailFK = 'FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE';

async function initializeDatabase() {
  const database = getDatabase();

  return new Promise((resolve, reject) => {
    database.serialize(() => {
      runCreateTable(database, 'users', [
        'email TEXT PRIMARY KEY', 'created_at DATETIME DEFAULT CURRENT_TIMESTAMP'
      ]);

      runCreateTable(database, 'clients', [
        'id INTEGER PRIMARY KEY AUTOINCREMENT', 'name TEXT NOT NULL', 'description TEXT',
        'department TEXT', 'email TEXT', 'user_email TEXT NOT NULL', ...TIMESTAMPS
      ], [userEmailFK]);

      runCreateTable(database, 'projects', [
        'id INTEGER PRIMARY KEY AUTOINCREMENT', 'name TEXT NOT NULL', 'description TEXT',
        'client_id INTEGER NOT NULL', 'start_date DATE', 'end_date DATE',
        "status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'on-hold'))",
        'budget_hours DECIMAL(10,2)', 'user_email TEXT NOT NULL', ...TIMESTAMPS
      ], ['FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE', userEmailFK]);

      runCreateTable(database, 'work_entries', [
        'id INTEGER PRIMARY KEY AUTOINCREMENT', 'client_id INTEGER NOT NULL', 'project_id INTEGER',
        'user_email TEXT NOT NULL', 'hours DECIMAL(5,2) NOT NULL', 'description TEXT',
        'date DATE NOT NULL', ...TIMESTAMPS
      ], [
        'FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE',
        'FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL',
        userEmailFK
      ]);

      const indexes = [
        ['idx_clients_user_email', 'clients', 'user_email'],
        ['idx_projects_client_id', 'projects', 'client_id'],
        ['idx_projects_user_email', 'projects', 'user_email'],
        ['idx_work_entries_client_id', 'work_entries', 'client_id'],
        ['idx_work_entries_project_id', 'work_entries', 'project_id'],
        ['idx_work_entries_user_email', 'work_entries', 'user_email'],
        ['idx_work_entries_date', 'work_entries', 'date'],
      ];
      for (const [idx, tbl, col] of indexes) {
        database.run(`CREATE INDEX IF NOT EXISTS ${idx} ON ${tbl} (${col})`);
      }

      console.log('Database tables created successfully');
      resolve();
    });
  });
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
  initializeDatabase,
  closeDatabase
};
