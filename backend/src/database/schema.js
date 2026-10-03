// Shared table DDL used by both the default and docker-override initializers.
const PROJECTS_TABLE = `
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    client_id INTEGER,
    start_date DATE,
    status TEXT NOT NULL DEFAULT 'active',
    user_email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE SET NULL,
    FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE
  )
`;

module.exports = {
  PROJECTS_TABLE,
};
