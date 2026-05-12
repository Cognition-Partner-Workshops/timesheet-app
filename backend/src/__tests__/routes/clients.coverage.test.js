const request = require('supertest');
const { getDatabase } = require('../../database/init');
const { createTestApp, setupMockDb } = require('../helpers/testSetup');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const clientRoutes = require('../../routes/clients');
const app = createTestApp('/api/clients', clientRoutes);

describe('Client Routes - Coverage Gaps', () => {
  let mockDb;

  beforeEach(() => { mockDb = setupMockDb(getDatabase); });
  afterEach(() => { jest.clearAllMocks(); });

  function stubClientExistsAndUpdate(updatedClient) {
    mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
    mockDb.run.mockImplementation((q, p, cb) => cb(null));
    mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, updatedClient));
  }

  describe('PUT /api/clients/:id - field updates', () => {
    test('should update client email field', async () => {
      stubClientExistsAndUpdate({ id: 1, name: 'Client', email: 'client@example.com' });

      const response = await request(app).put('/api/clients/1').send({ email: 'client@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.client.email).toBe('client@example.com');
    });

    test('should set email to null when empty string provided', async () => {
      stubClientExistsAndUpdate({ id: 1, name: 'Client', email: null });

      const response = await request(app).put('/api/clients/1').send({ email: '' });
      expect(response.status).toBe(200);
    });

    test('should update client department', async () => {
      stubClientExistsAndUpdate({ id: 1, name: 'Client', department: 'Engineering' });

      const response = await request(app).put('/api/clients/1').send({ department: 'Engineering' });

      expect(response.status).toBe(200);
      expect(response.body.client.department).toBe('Engineering');
    });

    test('should set department to null when empty string provided', async () => {
      stubClientExistsAndUpdate({ id: 1, name: 'Client', department: null });

      const response = await request(app).put('/api/clients/1').send({ department: '' });
      expect(response.status).toBe(200);
    });

    test('should update all fields simultaneously', async () => {
      const updated = { id: 1, name: 'New', description: 'Desc', department: 'Sales', email: 'n@e.com' };
      stubClientExistsAndUpdate(updated);

      const response = await request(app).put('/api/clients/1')
        .send({ name: 'New', description: 'Desc', department: 'Sales', email: 'n@e.com' });

      expect(response.status).toBe(200);
      expect(response.body.client).toEqual(updated);
    });
  });

  describe('PUT /api/clients/:id - catch block', () => {
    test('should handle unexpected error in try-catch', async () => {
      getDatabase.mockImplementation(() => { throw new Error('Unexpected crash'); });

      const response = await request(app).put('/api/clients/1').send({ name: 'Updated' });
      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/clients/ - bulk delete', () => {
    test('should delete all clients for user', async () => {
      mockDb.run.mockImplementation(function(q, p, cb) { this.changes = 3; cb.call(this, null); });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('All clients deleted successfully');
      expect(response.body.deletedCount).toBe(3);
    });

    test('should return success with zero deletedCount when no clients exist', async () => {
      mockDb.run.mockImplementation(function(q, p, cb) { this.changes = 0; cb.call(this, null); });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body.deletedCount).toBe(0);
    });

    test('should handle database error during bulk delete', async () => {
      mockDb.run.mockImplementation((q, p, cb) => cb(new Error('Bulk delete failed')));

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete clients' });
    });

    test('should only delete clients belonging to authenticated user', async () => {
      mockDb.run.mockImplementation(function(q, p, cb) { this.changes = 1; cb.call(this, null); });

      await request(app).delete('/api/clients');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM clients WHERE user_email = ?'),
        ['test@example.com'],
        expect.any(Function)
      );
    });
  });

  describe('POST /api/clients - catch block and edge cases', () => {
    test('should handle unexpected error in try-catch', async () => {
      getDatabase.mockImplementation(() => { throw new Error('Unexpected crash'); });

      const response = await request(app).post('/api/clients').send({ name: 'Test' });
      expect(response.status).toBe(500);
    });

    test('should create client with all optional fields', async () => {
      const newClient = { name: 'Full', description: 'D', department: 'Eng', email: 'c@e.com' };
      const created = { id: 1, ...newClient, created_at: '2024-01-01', updated_at: '2024-01-01' };

      mockDb.run.mockImplementation(function(q, p, cb) { this.lastID = 1; cb.call(this, null); });
      mockDb.get.mockImplementation((q, p, cb) => cb(null, created));

      const response = await request(app).post('/api/clients').send(newClient);

      expect(response.status).toBe(201);
      expect(response.body.client.department).toBe('Eng');
    });

    test('should return 400 for name exceeding max length', async () => {
      const response = await request(app).post('/api/clients').send({ name: 'A'.repeat(256) });
      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid email format', async () => {
      const response = await request(app).post('/api/clients').send({ name: 'C', email: 'bad' });
      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/clients/:id - validation edge cases', () => {
    test('should return 400 for invalid email format in update', async () => {
      const response = await request(app).put('/api/clients/1').send({ email: 'bad' });
      expect(response.status).toBe(400);
    });

    test('should return 400 for name exceeding max length in update', async () => {
      const response = await request(app).put('/api/clients/1').send({ name: 'A'.repeat(256) });
      expect(response.status).toBe(400);
    });
  });
});
