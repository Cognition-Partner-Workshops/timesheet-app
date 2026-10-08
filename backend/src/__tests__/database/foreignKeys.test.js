jest.unmock('sqlite3');

describe('Database foreign keys', () => {
  let databaseModule;

  beforeAll(() => {
    jest.isolateModules(() => {
      databaseModule = require('../../database/init');
    });
  });

  afterAll(async () => {
    await databaseModule.closeDatabase();
  });

  test('deleting a client cascades to its projects', async () => {
    await databaseModule.initializeDatabase();
    const db = databaseModule.getDatabase();
    const run = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.run(sql, params, function (error) {
          if (error) {
            reject(error);
          } else {
            resolve(this);
          }
        });
      });
    const get = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
          if (error) {
            reject(error);
          } else {
            resolve(row);
          }
        });
      });

    await run('INSERT INTO users (email) VALUES (?)', ['cascade@example.com']);
    const client = await run(
      'INSERT INTO clients (name, user_email) VALUES (?, ?)',
      ['Cascade Client', 'cascade@example.com']
    );
    const project = await run(
      'INSERT INTO projects (name, client_id, user_email, start_date) VALUES (?, ?, ?, ?)',
      ['Cascade Project', client.lastID, 'cascade@example.com', '2024-01-01']
    );

    await run('DELETE FROM clients WHERE id = ?', [client.lastID]);

    await expect(get('SELECT id FROM projects WHERE id = ?', [project.lastID])).resolves.toBeUndefined();
  });
});
