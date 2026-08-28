const mysql = require('mysql2');

let pool = null;
let dbWrapper = null;

function getDatabase() {
  if (!dbWrapper) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'timesheet',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('Connected to MySQL database');

    // Wrapper that mimics the SQLite callback API used by route files
    dbWrapper = {
      get(query, params, callback) {
        if (typeof params === 'function') {
          callback = params;
          params = [];
        }
        pool.query(query, params, (err, rows) => {
          if (err) return callback(err, null);
          callback(null, rows[0] || null);
        });
      },

      all(query, params, callback) {
        if (typeof params === 'function') {
          callback = params;
          params = [];
        }
        pool.query(query, params, (err, rows) => {
          if (err) return callback(err, null);
          callback(null, rows);
        });
      },

      run(query, params, callback) {
        if (typeof params === 'function') {
          callback = params;
          params = [];
        }
        pool.query(query, params, (err, result) => {
          if (typeof callback === 'function') {
            const context = {
              lastID: result ? result.insertId : null,
              changes: result ? result.affectedRows : 0
            };
            callback.call(context, err);
          }
        });
      },

      serialize(callback) {
        if (typeof callback === 'function') {
          callback();
        }
      }
    };
  }
  return dbWrapper;
}

async function initializeDatabase() {
  const database = getDatabase();
  const promisePool = pool.promise();

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS users (
      email VARCHAR(255) PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      department VARCHAR(255),
      email VARCHAR(255),
      user_email VARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE
    )
  `);

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS work_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      user_email VARCHAR(255) NOT NULL,
      hours DECIMAL(5,2) NOT NULL,
      description TEXT,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
      FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE
    )
  `);

  await promisePool.query(`CREATE INDEX IF NOT EXISTS idx_clients_user_email ON clients (user_email)`);
  await promisePool.query(`CREATE INDEX IF NOT EXISTS idx_work_entries_client_id ON work_entries (client_id)`);
  await promisePool.query(`CREATE INDEX IF NOT EXISTS idx_work_entries_user_email ON work_entries (user_email)`);
  await promisePool.query(`CREATE INDEX IF NOT EXISTS idx_work_entries_date ON work_entries (date)`);

  console.log('Database tables created successfully');
}

function closeDatabase() {
  return new Promise((resolve) => {
    if (!pool) {
      resolve();
      return;
    }

    pool.end((err) => {
      pool = null;
      dbWrapper = null;
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
