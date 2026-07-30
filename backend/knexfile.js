const path = require('node:path');

const baseConfig = {
  client: 'sqlite3',
  useNullAsDefault: true,
  pool: {
    min: 1,
    max: 1,
    afterCreate: (conn, done) => {
      conn.run('PRAGMA foreign_keys = ON', done);
    }
  },
  migrations: {
    directory: path.join(__dirname, 'src', 'database', 'migrations')
  }
};

module.exports = {
  development: {
    ...baseConfig,
    connection: {
      filename: process.env.DATABASE_PATH || path.join(__dirname, 'data', 'timesheet.db')
    }
  },
  test: {
    ...baseConfig,
    connection: {
      filename: ':memory:'
    }
  },
  production: {
    ...baseConfig,
    connection: {
      filename: process.env.DATABASE_PATH || '/app/data/timesheet.db'
    }
  }
};
