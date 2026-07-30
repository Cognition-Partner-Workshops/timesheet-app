jest.unmock('sqlite3');

const { getDatabase, initializeDatabase, closeDatabase } = require('../../database/init');

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

describe('Database foreign keys', () => {
  let db;

  beforeAll(async () => {
    await initializeDatabase();
    db = getDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  test('should clear project client assignment when client is deleted', async () => {
    await run(db, 'INSERT INTO users (email) VALUES (?)', ['test@example.com']);
    const client = await run(
      db,
      'INSERT INTO clients (name, user_email) VALUES (?, ?)',
      ['Test Client', 'test@example.com']
    );
    await run(
      db,
      'INSERT INTO projects (name, client_id, user_email) VALUES (?, ?, ?)',
      ['Test Project', client.lastID, 'test@example.com']
    );

    await run(db, 'DELETE FROM clients WHERE id = ?', [client.lastID]);

    const project = await get(db, 'SELECT client_id FROM projects WHERE name = ?', ['Test Project']);
    expect(project.client_id).toBeNull();
  });
});
