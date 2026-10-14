const fs = require('fs');
const path = require('path');

const overridesPath = path.resolve(__dirname, '../../../docker/overrides');

describe('Docker production overrides', () => {
  test('keeps API caching and rate-limit protections aligned with the app server', () => {
    const server = fs.readFileSync(path.join(overridesPath, 'server.js'), 'utf8');

    expect(server).toContain("app.disable('etag')");
    expect(server).toContain("require('./middleware/noStoreApi')");
    expect(server).toContain('Number(process.env.RATE_LIMIT_MAX) || 100');
  });

  test('keeps foreign-key enforcement enabled for the file-based database', () => {
    const database = fs.readFileSync(path.join(overridesPath, 'database/init.js'), 'utf8');

    expect(database).toContain("database.run('PRAGMA foreign_keys = ON')");
  });
});
