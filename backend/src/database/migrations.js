function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function addColumnIfMissing(db, table, column, definition) {
  const columns = await all(db, `PRAGMA table_info(${table})`);
  if (!columns.some((c) => c.name === column)) {
    await run(db, `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Each migration runs once, in order, inside a transaction. Never edit a
// migration that has shipped; append a new one instead.
const migrations = [
  async function baselineSchema(db) {
    await run(db, `
      CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await run(db, `
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        department TEXT,
        email TEXT,
        user_email TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE
      )
    `);
    await run(db, `
      CREATE TABLE IF NOT EXISTS work_entries (
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
      )
    `);
    // Databases created by the old docker/overrides schema lack these columns.
    await addColumnIfMissing(db, 'clients', 'department', 'TEXT');
    await addColumnIfMissing(db, 'clients', 'email', 'TEXT');

    await run(db, 'CREATE INDEX IF NOT EXISTS idx_clients_user_email ON clients (user_email)');
    await run(db, 'CREATE INDEX IF NOT EXISTS idx_work_entries_client_id ON work_entries (client_id)');
    await run(db, 'CREATE INDEX IF NOT EXISTS idx_work_entries_user_email ON work_entries (user_email)');
    await run(db, 'CREATE INDEX IF NOT EXISTS idx_work_entries_date ON work_entries (date)');
  },

  async function normalizeWorkEntryDates(db) {
    // Older versions stored dates as epoch milliseconds or full ISO timestamps.
    await run(db, `
      UPDATE work_entries
      SET date = strftime('%Y-%m-%d', date / 1000, 'unixepoch')
      WHERE typeof(date) IN ('integer', 'real')
    `);
    await run(db, `
      UPDATE work_entries
      SET date = substr(date, 1, 10)
      WHERE typeof(date) = 'text' AND length(date) > 10
    `);
  },
];

async function runMigrations(db, migrationList = migrations) {
  const { user_version: currentVersion } = await get(db, 'PRAGMA user_version');

  for (let version = currentVersion; version < migrationList.length; version++) {
    await run(db, 'BEGIN IMMEDIATE');
    try {
      await migrationList[version](db);
      await run(db, `PRAGMA user_version = ${version + 1}`);
      await run(db, 'COMMIT');
    } catch (err) {
      await run(db, 'ROLLBACK');
      throw err;
    }
  }

  return migrationList.length;
}

module.exports = {
  migrations,
  runMigrations,
  run,
  get,
  all,
};
