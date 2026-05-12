const TABLE_DEFINITIONS = [
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
  `CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    client_id INTEGER,
    start_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'on-hold')),
    user_email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE SET NULL,
    FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE
  )`,
];

const INDEX_DEFINITIONS = [
  'CREATE INDEX IF NOT EXISTS idx_clients_user_email ON clients (user_email)',
  'CREATE INDEX IF NOT EXISTS idx_work_entries_client_id ON work_entries (client_id)',
  'CREATE INDEX IF NOT EXISTS idx_work_entries_user_email ON work_entries (user_email)',
  'CREATE INDEX IF NOT EXISTS idx_work_entries_date ON work_entries (date)',
  'CREATE INDEX IF NOT EXISTS idx_projects_user_email ON projects (user_email)',
  'CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects (client_id)',
  'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status)',
];

function createSchema(database) {
  for (const sql of TABLE_DEFINITIONS) database.run(sql);
  for (const sql of INDEX_DEFINITIONS) database.run(sql);
}

module.exports = { TABLE_DEFINITIONS, INDEX_DEFINITIONS, createSchema };
