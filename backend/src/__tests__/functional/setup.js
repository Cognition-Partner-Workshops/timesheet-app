const { initializeDatabase, closeDatabase } = require('../../database/init');

beforeAll(async () => {
  await initializeDatabase();
});

afterAll(async () => {
  await closeDatabase();
});
