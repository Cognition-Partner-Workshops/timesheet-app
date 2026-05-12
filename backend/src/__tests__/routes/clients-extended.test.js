const request = require('supertest');
const { getDatabase } = require('../../database/init');
const { createMockDb, createTestApp, mockDbRunSuccess, mockDbRunError } = require('../helpers/testUtils');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({ authenticateUser: (req, res, next) => { req.userEmail = 'test@example.com'; next(); } }));

const clientRoutes = require('../../routes/clients');
const app = createTestApp('/api/clients', clientRoutes);

describe('Client Routes - Extended Coverage', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('DELETE /api/clients (delete all)', () => {
    test('should delete all clients for authenticated user', async () => {
      mockDbRunSuccess(mockDb, 3);
      const response = await request(app).delete('/api/clients');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'All clients deleted successfully',
        deletedCount: 3
      });
    });

    test('should return zero deleted count when no clients exist', async () => {
      mockDbRunSuccess(mockDb, 0);
      const response = await request(app).delete('/api/clients');
      expect(response.status).toBe(200);
      expect(response.body.deletedCount).toBe(0);
    });

    test('should handle database error when deleting all clients', async () => {
      mockDbRunError(mockDb, 'Database error');
      const response = await request(app).delete('/api/clients');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete clients' });
    });

    test('should only delete clients for the authenticated user email', async () => {
      mockDbRunSuccess(mockDb, 1);
      await request(app).delete('/api/clients');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM clients WHERE user_email = ?'),
        ['test@example.com'],
        expect.any(Function)
      );
    });
  });

  describe('PUT /api/clients/:id - Email and department fields', () => {
    const setupUpdateMocks = (updatedClient) => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT id FROM clients')) {
          callback(null, { id: 1 });
        } else {
          callback(null, updatedClient);
        }
      });
      mockDbRunSuccess(mockDb);
    };

    test('should update client email field', async () => {
      setupUpdateMocks({
        id: 1, name: 'Client', description: null, department: null,
        email: 'client@corp.com', created_at: '2024-01-01', updated_at: '2024-01-02'
      });
      const response = await request(app)
        .put('/api/clients/1')
        .send({ email: 'client@corp.com' });
      expect(response.status).toBe(200);
      expect(response.body.client.email).toBe('client@corp.com');
    });

    test('should set email to null when empty string provided', async () => {
      setupUpdateMocks({
        id: 1, name: 'Client', description: null, department: null,
        email: null, created_at: '2024-01-01', updated_at: '2024-01-02'
      });
      const response = await request(app)
        .put('/api/clients/1')
        .send({ email: '' });
      expect(response.status).toBe(200);
    });

    test('should update department field', async () => {
      setupUpdateMocks({
        id: 1, name: 'Client', description: null, department: 'Engineering',
        email: null, created_at: '2024-01-01', updated_at: '2024-01-02'
      });
      const response = await request(app)
        .put('/api/clients/1')
        .send({ department: 'Engineering' });
      expect(response.status).toBe(200);
      expect(response.body.client.department).toBe('Engineering');
    });

    test('should set department to null when empty string provided', async () => {
      setupUpdateMocks({
        id: 1, name: 'Client', description: null, department: null,
        email: null, created_at: '2024-01-01', updated_at: '2024-01-02'
      });
      const response = await request(app)
        .put('/api/clients/1')
        .send({ department: '' });
      expect(response.status).toBe(200);
    });
  });

  describe('PUT /api/clients/:id - Error handling', () => {
    test('should handle database error after update but failed retrieval', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT id FROM clients')) {
          callback(null, { id: 1 });
        } else {
          callback(new Error('Retrieval failed'), null);
        }
      });
      mockDbRunSuccess(mockDb);
      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'Updated' });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Client updated but failed to retrieve' });
    });

    test('should handle database error during update execution', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDbRunError(mockDb, 'Update failed');
      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'Updated Name' });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update client' });
    });

    test('should handle synchronous errors via next(error)', async () => {
      getDatabase.mockImplementation(() => { throw new Error('Unexpected'); });
      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'Test' });
      expect(response.status).toBe(500);
    });
  });
});
