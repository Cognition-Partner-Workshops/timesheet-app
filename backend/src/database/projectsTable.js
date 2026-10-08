// Shared by src/database/init.js and docker/overrides/database/init.js
function createProjectsTable(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      client_id INTEGER NOT NULL,
      start_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on-hold')),
      user_email TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
      FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE
    )
  `);
  database.run(`CREATE INDEX IF NOT EXISTS idx_projects_user_email ON projects (user_email)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects (client_id)`);
}

module.exports = { createProjectsTable };
