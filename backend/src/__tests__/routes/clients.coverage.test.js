const request = require('supertest');
const { getDatabase } = require('../../database/init');
const clientRoutes = require('../../routes/clients');
const { setupMockDb, createTestApp, mockDbRun, mockDbGet } = require('../helpers/testSetup');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const app = createTestApp('/api/clients', clientRoutes);

describe('Client Routes - Coverage Gaps', () => {
  let mockDb;

  beforeEach(() => { mockDb = setupMockDb(); });
  afterEach(() => { jest.clearAllMocks(); });

  describe('DELETE /api/clients (delete all)', () => {
    test('should delete all clients for the user', async () => {
      mockDbRun(mockDb, null, { changes: 3 });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('All clients deleted successfully');
      expect(response.body.deletedCount).toBe(3);
    });

    test('should return success with zero deleted when no clients', async () => {
      mockDbRun(mockDb, null, { changes: 0 });
      const response = await request(app).delete('/api/clients');
      expect(response.status).toBe(200);
      expect(response.body.deletedCount).toBe(0);
    });

    test('should handle database error when deleting all clients', async () => {
      mockDbRun(mockDb, new Error('Delete failed'));
      const response = await request(app).delete('/api/clients');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete clients' });
    });
  });

  describe('PUT /api/clients/:id - Update department and email fields', () => {
    function mockExistsAndUpdate(mockDb, updatedClient) {
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation((q, p, cb) => cb(null));
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, updatedClient));
    }

    test('should update client department', async () => {
      const updated = { id: 1, name: 'Client', department: 'Engineering' };
      mockExistsAndUpdate(mockDb, updated);
      const response = await request(app).put('/api/clients/1').send({ department: 'Engineering' });
      expect(response.status).toBe(200);
      expect(response.body.client.department).toBe('Engineering');
    });

    test('should update client email', async () => {
      const updated = { id: 1, name: 'Client', email: 'client@example.com' };
      mockExistsAndUpdate(mockDb, updated);
      const response = await request(app).put('/api/clients/1').send({ email: 'client@example.com' });
      expect(response.status).toBe(200);
      expect(response.body.client.email).toBe('client@example.com');
    });

    test('should update all fields at once', async () => {
      const updated = { id: 1, name: 'Updated', description: 'New desc', department: 'Sales', email: 'new@example.com' };
      mockExistsAndUpdate(mockDb, updated);
      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'Updated', description: 'New desc', department: 'Sales', email: 'new@example.com' });
      expect(response.status).toBe(200);
      expect(response.body.client).toEqual(updated);
    });

    test('should set department to null when empty string provided', async () => {
      mockExistsAndUpdate(mockDb, { id: 1, department: null });
      const response = await request(app).put('/api/clients/1').send({ department: '' });
      expect(response.status).toBe(200);
    });

    test('should set email to null when empty string provided', async () => {
      mockExistsAndUpdate(mockDb, { id: 1, email: null });
      const response = await request(app).put('/api/clients/1').send({ email: '' });
      expect(response.status).toBe(200);
    });
  });

  describe('Try-catch error paths', () => {
    test('should handle unexpected throw in POST handler', async () => {
      getDatabase.mockImplementation(() => { throw new Error('Unexpected'); });
      const response = await request(app).post('/api/clients').send({ name: 'Test' });
      expect(response.status).toBe(500);
    });

    test('should handle unexpected throw in PUT handler', async () => {
      getDatabase.mockImplementation(() => { throw new Error('Unexpected'); });
      const response = await request(app).put('/api/clients/1').send({ name: 'Updated' });
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/clients - Create with all optional fields', () => {
    test('should create client with department and email', async () => {
      const newClient = { name: 'Full Client', description: 'A client', department: 'Engineering', email: 'client@example.com' };
      mockDbRun(mockDb, null, { lastID: 1 });
      mockDbGet(mockDb, { id: 1, ...newClient });

      const response = await request(app).post('/api/clients').send(newClient);
      expect(response.status).toBe(201);
      expect(response.body.client.department).toBe('Engineering');
    });
  });
});
