const { request, createTestApp, setupMockDb, mockRunWithLastID, mockDbRow, mockDbRows } = require('../helpers/testSetup');
const { getDatabase } = require('../../database/init');
const workEntryRoutes = require('../../routes/workEntries');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const app = createTestApp('/api/work-entries', workEntryRoutes);

describe('Work Entry Routes - Coverage Improvement', () => {
  let mockDb;

  beforeEach(() => { mockDb = setupMockDb(); });
  afterEach(() => { jest.clearAllMocks(); });

  describe('POST /api/work-entries - Catch Block (line 139)', () => {
    test('should handle unexpected error thrown during POST processing', async () => {
      getDatabase.mockImplementation(() => { throw new Error('Unexpected runtime error'); });
      const response = await request(app).post('/api/work-entries').send({ clientId: 1, hours: 5, date: '2024-01-15' });
      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/work-entries/:id - Catch Block (line 256)', () => {
    test('should handle unexpected error thrown during PUT processing', async () => {
      getDatabase.mockImplementation(() => { throw new Error('Unexpected runtime error'); });
      const response = await request(app).put('/api/work-entries/1').send({ hours: 8 });
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/work-entries - Additional Edge Cases', () => {
    function setupCreateMocks(returnedEntry) {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('clients')) callback(null, { id: 1 });
        else callback(null, returnedEntry);
      });
      mockDb.run.mockImplementation(mockRunWithLastID(1));
    }

    test('should create work entry without optional description', async () => {
      setupCreateMocks({ id: 1, client_id: 1, hours: 3, description: null, date: '2024-01-15', client_name: 'Client A' });
      const response = await request(app).post('/api/work-entries').send({ clientId: 1, hours: 3, date: '2024-01-15' });
      expect(response.status).toBe(201);
    });

    test('should create work entry with empty description', async () => {
      setupCreateMocks({ id: 1, client_id: 1, hours: 2, description: null, date: '2024-01-15', client_name: 'Client A' });
      const response = await request(app).post('/api/work-entries').send({ clientId: 1, hours: 2, description: '', date: '2024-01-15' });
      expect(response.status).toBe(201);
    });

    test('should accept work entry with boundary hours (24 max)', async () => {
      setupCreateMocks({ id: 1, hours: 24, client_name: 'Client A' });
      const response = await request(app).post('/api/work-entries').send({ clientId: 1, hours: 24, date: '2024-01-15' });
      expect(response.status).toBe(201);
    });

    test('should accept work entry with very small hours (0.01)', async () => {
      setupCreateMocks({ id: 1, hours: 0.01, client_name: 'Client A' });
      const response = await request(app).post('/api/work-entries').send({ clientId: 1, hours: 0.01, date: '2024-01-15' });
      expect(response.status).toBe(201);
    });

    test.each([
      ['zero hours', { clientId: 1, hours: 0, date: '2024-01-15' }],
      ['missing date', { clientId: 1, hours: 5 }],
      ['non-ISO date format', { clientId: 1, hours: 5, date: '01-15-2024' }]
    ])('should reject work entry with %s', async (_, body) => {
      const response = await request(app).post('/api/work-entries').send(body);
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/work-entries - Edge Cases', () => {
    test('should return empty array when no work entries exist', async () => {
      mockDb.all.mockImplementation(mockDbRows([]));
      const response = await request(app).get('/api/work-entries');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ workEntries: [] });
    });

    test('should handle numeric string clientId filter', async () => {
      mockDb.all.mockImplementation(mockDbRows([]));
      const response = await request(app).get('/api/work-entries?clientId=42');
      expect(response.status).toBe(200);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND we.client_id = ?'),
        ['test@example.com', 42],
        expect.any(Function)
      );
    });

    test('should handle clientId filter with zero', async () => {
      mockDb.all.mockImplementation(mockDbRows([]));
      const response = await request(app).get('/api/work-entries?clientId=0');
      expect(response.status).toBe(200);
    });
  });

  describe('PUT /api/work-entries/:id - Update with New Client Validation', () => {
    test('should update work entry with new valid client and other fields', async () => {
      let getCallCount = 0;
      mockDb.get.mockImplementation((query, params, callback) => {
        getCallCount++;
        if (getCallCount === 1) callback(null, { id: 1 });
        else if (getCallCount === 2) callback(null, { id: 2 });
        else callback(null, { id: 1, client_id: 2, hours: 10, description: 'Updated', client_name: 'Client B' });
      });
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app).put('/api/work-entries/1').send({ clientId: 2, hours: 10, description: 'Updated' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Work entry updated successfully');
    });
  });

  describe('DELETE /api/work-entries/:id - Edge Cases', () => {
    test.each([
      ['ID 0', '/api/work-entries/0'],
      ['negative ID', '/api/work-entries/-1']
    ])('should return 404 for %s', async (_, url) => {
      mockDb.get.mockImplementation(mockDbRow(null));
      const response = await request(app).delete(url);
      expect(response.status).toBe(404);
    });
  });
});
