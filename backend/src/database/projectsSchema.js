// Shared by the dev init and docker/overrides/database/init.js so the projects schema stays in one place.
const PROJECTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    client_id INTEGER NOT NULL,
    user_email TEXT NOT NULL,
    start_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on-hold')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
    FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE
  )
`;

const PROJECTS_INDEX_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_projects_user_email ON projects (user_email)',
  'CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects (client_id)'
];

module.exports = { PROJECTS_TABLE_SQL, PROJECTS_INDEX_SQL };
