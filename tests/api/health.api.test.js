const { setupTestApp } = require('../helpers/test-server');
const { TestApiClient } = require('../helpers/api-client');

describe('Health Check', () => {
  let app;
  let api;

  beforeAll(async () => {
    app = await setupTestApp();
    api = new TestApiClient(app);
  });

  it('should return OK status', async () => {
    const res = await api.healthCheck();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.timestamp).toBeDefined();
  });
});
