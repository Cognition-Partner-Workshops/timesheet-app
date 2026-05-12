const request = require('supertest');
const { getDatabase } = require('../../database/init');
const { createMockDb, createTestApp, mockDbRunSuccess, mockDbRunError } = require('../helpers/testUtils');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const workEntryRoutes = require('../../routes/workEntries');
const app = createTestApp('/api/work-entries', workEntryRoutes);

describe('Work Entries Routes - Extended Coverage', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/work-entries - Catch block', () => {
    test('should handle synchronous errors via next(error)', async () => {
      getDatabase.mockImplementation(() => { throw new Error('Unexpected'); });
      const response = await request(app)
        .post('/api/work-entries')
        .send({ clientId: 1, hours: 5, date: '2024-01-01', description: 'Test' });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('PUT /api/work-entries/:id - Catch block and edge cases', () => {
    test('should handle synchronous errors via next(error)', async () => {
      getDatabase.mockImplementation(() => { throw new Error('Unexpected'); });
      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ hours: 8, date: '2024-01-01' });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should return 400 for invalid work entry ID', async () => {
      const response = await request(app).put('/api/work-entries/invalid').send({ hours: 5 });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid work entry ID' });
    });

    test('should return 404 when work entry not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));
      const response = await request(app).put('/api/work-entries/999').send({ hours: 5 });
      expect(response.status).toBe(404);
    });

    test('should return 500 on database error during existence check', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });
      const response = await request(app).put('/api/work-entries/1').send({ hours: 5 });
      expect(response.status).toBe(500);
    });

    test('should successfully update work entry', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT id FROM')) {
          callback(null, { id: 1 });
        } else {
          callback(null, { id: 1, client_id: 1, hours: 8, description: 'Done', date: '2024-01-02', client_name: 'Client' });
        }
      });
      mockDbRunSuccess(mockDb);
      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ clientId: 1, hours: 8, description: 'Done', date: '2024-01-02' });
      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/work-entries/:id - Edge cases', () => {
    test('should return 400 for non-numeric ID', async () => {
      const response = await request(app).delete('/api/work-entries/abc');
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid work entry ID' });
    });

    test('should return 404 when entry not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));
      const response = await request(app).delete('/api/work-entries/999');
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Work entry not found' });
    });

    test('should return 500 on database error during lookup', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('DB error'), null);
      });
      const response = await request(app).delete('/api/work-entries/1');
      expect(response.status).toBe(500);
    });

    test('should return 500 on database error during delete', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDbRunError(mockDb, 'Delete failed');
      const response = await request(app).delete('/api/work-entries/1');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete work entry' });
    });

    test('should successfully delete work entry', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDbRunSuccess(mockDb);
      const response = await request(app).delete('/api/work-entries/1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Work entry deleted successfully' });
    });
  });

  describe('POST /api/work-entries - Boundary validations', () => {
    test('should reject zero hours', async () => {
      const response = await request(app)
        .post('/api/work-entries')
        .send({ clientId: 1, hours: 0, date: '2024-01-01' });
      expect(response.status).toBe(400);
    });

    test('should reject negative hours', async () => {
      const response = await request(app)
        .post('/api/work-entries')
        .send({ clientId: 1, hours: -1, date: '2024-01-01' });
      expect(response.status).toBe(400);
    });

    test('should reject hours exceeding 24', async () => {
      const response = await request(app)
        .post('/api/work-entries')
        .send({ clientId: 1, hours: 25, date: '2024-01-01' });
      expect(response.status).toBe(400);
    });

    test('should reject missing required fields', async () => {
      const response = await request(app).post('/api/work-entries').send({});
      expect(response.status).toBe(400);
    });
  });
});
