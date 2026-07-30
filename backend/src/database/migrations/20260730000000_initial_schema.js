exports.up = async function up(knex) {
  const hasUsers = await knex.schema.hasTable('users');
  if (!hasUsers) {
    await knex.raw(`
      CREATE TABLE users (
        email TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  const hasClients = await knex.schema.hasTable('clients');
  if (!hasClients) {
    await knex.raw(`
      CREATE TABLE clients (
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
  } else {
    // Databases created by the legacy Docker override are missing these columns
    if (!(await knex.schema.hasColumn('clients', 'department'))) {
      await knex.raw('ALTER TABLE clients ADD COLUMN department TEXT');
    }
    if (!(await knex.schema.hasColumn('clients', 'email'))) {
      await knex.raw('ALTER TABLE clients ADD COLUMN email TEXT');
    }
  }

  const hasWorkEntries = await knex.schema.hasTable('work_entries');
  if (!hasWorkEntries) {
    await knex.raw(`
      CREATE TABLE work_entries (
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
  }

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_clients_user_email ON clients (user_email)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_work_entries_client_id ON work_entries (client_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_work_entries_user_email ON work_entries (user_email)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_work_entries_date ON work_entries (date)');
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('work_entries');
  await knex.schema.dropTableIfExists('clients');
  await knex.schema.dropTableIfExists('users');
};
