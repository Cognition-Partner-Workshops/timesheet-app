const request = require('supertest');
const app = require('../server');

describe('API response caching', () => {
  test('marks API responses no-store and omits ETags', async () => {
    const response = await request(app).get('/api/not-found');

    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.etag).toBeUndefined();
  });
});
