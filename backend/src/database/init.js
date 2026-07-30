const knex = require('knex');
const path = require('node:path');
const fs = require('node:fs');
const knexConfig = require('../../knexfile');

let knexInstance = null;
let rawDb = null;

function getKnex() {
  if (!knexInstance) {
    const env = process.env.NODE_ENV || 'development';
    const config = knexConfig[env] || knexConfig.development;

    const { filename } = config.connection;
    if (filename !== ':memory:') {
      const dbDir = path.dirname(filename);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    }

    knexInstance = knex(config);
  }
  return knexInstance;
}

function getDatabase() {
  if (!rawDb) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return rawDb;
}

async function initializeDatabase() {
  const k = getKnex();

  await k.migrate.latest();

  // Capture the single pooled sqlite3 connection (pool is min:1/max:1) so
  // callers can use the raw sqlite3 API (db.run/get/all) against the
  // migrated database, then release it so Knex queries can still run
  if (!rawDb) {
    const conn = await k.client.acquireConnection();
    rawDb = conn;
    k.client.releaseConnection(conn);
  }

  const { filename } = k.client.config.connection;
  const dbType = filename === ':memory:' ? 'in-memory' : `file: ${filename}`;
  console.log(`Connected to SQLite database (${dbType})`);
  console.log('Database migrations applied successfully');
}

async function closeDatabase() {
  if (!knexInstance) {
    return;
  }

  rawDb = null;

  try {
    await knexInstance.destroy();
    console.log('Database connection closed');
  } catch (err) {
    console.error('Error closing database:', err);
  } finally {
    knexInstance = null;
  }
}

module.exports = {
  getKnex,
  getDatabase,
  initializeDatabase,
  closeDatabase
};
