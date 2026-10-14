const request = require('supertest');
const clientRoutes = require('../../routes/clients');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const { createTestApp, createMockDb, mockDbAll, mockDbGet, mockDbRun, mockDbGetSequence } = require('../helpers/testApp');

const app = createTestApp('/api/clients', clientRoutes);

describe('Client Routes', () => {
  let mockDb;

  beforeEach(() => { mockDb = createMockDb(); });
  afterEach(() => { jest.clearAllMocks(); });

  describe('GET /api/clients', () => {
    test('should return all clients for authenticated user', async () => {
      const mockClients = [
        { id: 1, name: 'Client A', description: 'Desc A', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, name: 'Client B', description: 'Desc B', created_at: '2024-01-02', updated_at: '2024-01-02' }
      ];
      mockDbAll(mockDb, mockClients);

      const response = await request(app).get('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ clients: mockClients });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['test@example.com'],
        expect.any(Function)
      );
    });

    test('should return empty array when no clients exist', async () => {
      mockDbAll(mockDb, []);
      const response = await request(app).get('/api/clients');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ clients: [] });
    });

    test('should handle database error', async () => {
      mockDbAll(mockDb, null, new Error('Database error'));
      const response = await request(app).get('/api/clients');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/clients/:id', () => {
    test('should return specific client', async () => {
      const mockClient = { id: 1, name: 'Client A', description: 'Desc A' };
      mockDbGet(mockDb, mockClient);

      const response = await request(app).get('/api/clients/1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ client: mockClient });
    });

    test('should return 404 if client not found', async () => {
      mockDbGet(mockDb, null);
      const response = await request(app).get('/api/clients/999');
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
    });

    test('should return 400 for invalid client ID', async () => {
      const response = await request(app).get('/api/clients/invalid');
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });

    test('should handle database error', async () => {
      mockDbGet(mockDb, null, new Error('Database error'));
      const response = await request(app).get('/api/clients/1');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/clients', () => {
    test('should create new client with valid data', async () => {
      const newClient = { name: 'New Client', description: 'New Description' };
      const createdClient = { id: 1, ...newClient, created_at: '2024-01-01', updated_at: '2024-01-01' };
      mockDbRun(mockDb, null, 1);
      mockDbGet(mockDb, createdClient);

      const response = await request(app).post('/api/clients').send(newClient);
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Client created successfully');
      expect(response.body.client).toEqual(createdClient);
    });

    test('should create client without description', async () => {
      const createdClient = { id: 1, name: 'Client Without Desc', description: null };
      mockDbRun(mockDb, null, 1);
      mockDbGet(mockDb, createdClient);

      const response = await request(app).post('/api/clients').send({ name: 'Client Without Desc' });
      expect(response.status).toBe(201);
    });

    test('should return 400 for missing name', async () => {
      const response = await request(app).post('/api/clients').send({ description: 'No name provided' });
      expect(response.status).toBe(400);
    });

    test('should return 400 for empty name', async () => {
      const response = await request(app).post('/api/clients').send({ name: '' });
      expect(response.status).toBe(400);
    });

    test('should handle database insert error', async () => {
      mockDbRun(mockDb, new Error('Insert failed'));
      const response = await request(app).post('/api/clients').send({ name: 'Test Client' });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create client' });
    });

    test('should handle error retrieving client after creation', async () => {
      mockDbRun(mockDb, null, 1);
      mockDbGet(mockDb, null, new Error('Retrieval failed'));

      const response = await request(app).post('/api/clients').send({ name: 'Test Client' });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Client created but failed to retrieve' });
    });
  });

  describe('PUT /api/clients/:id', () => {
    test('should update client name', async () => {
      const updatedClient = { id: 1, name: 'Updated Name', description: 'Old Desc' };
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, updatedClient));

      const response = await request(app).put('/api/clients/1').send({ name: 'Updated Name' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Client updated successfully');
      expect(response.body.client).toEqual(updatedClient);
    });

    test('should update client description', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, { id: 1, name: 'Client', description: 'New Description' }));

      const response = await request(app).put('/api/clients/1').send({ description: 'New Description' });
      expect(response.status).toBe(200);
    });

    test('should return 404 if client not found', async () => {
      mockDbGet(mockDb, null);
      const response = await request(app).put('/api/clients/999').send({ name: 'Updated' });
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
    });

    test('should return 400 for invalid client ID', async () => {
      const response = await request(app).put('/api/clients/invalid').send({ name: 'Updated' });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });

    test('should return 400 for empty update', async () => {
      const response = await request(app).put('/api/clients/1').send({});
      expect(response.status).toBe(400);
    });

    test('should handle database error when checking client existence', async () => {
      mockDbGet(mockDb, null, new Error('Database error'));
      const response = await request(app).put('/api/clients/1').send({ name: 'Updated Name' });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error during update', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('Update failed')));

      const response = await request(app).put('/api/clients/1').send({ name: 'Updated Name' });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update client' });
    });

    test('should handle error retrieving client after update', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(new Error('Retrieval failed'), null));

      const response = await request(app).put('/api/clients/1').send({ name: 'Updated Name' });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Client updated but failed to retrieve' });
    });

    test('should update both name and description', async () => {
      const updatedClient = { id: 1, name: 'New Name', description: 'New Description' };
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, updatedClient));

      const response = await request(app).put('/api/clients/1').send({ name: 'New Name', description: 'New Description' });
      expect(response.status).toBe(200);
      expect(response.body.client).toEqual(updatedClient);
    });

    test('should update description to null when empty string provided', async () => {
      const updatedClient = { id: 1, name: 'Client', description: null };
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, updatedClient));

      const response = await request(app).put('/api/clients/1').send({ description: '' });
      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/clients', () => {
    test('should delete all clients for user', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.changes = 3;
        callback.call(this, null);
      });

      const response = await request(app).delete('/api/clients');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('All clients deleted successfully');
      expect(response.body.deletedCount).toBe(3);
    });

    test('should handle database error on bulk delete', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, new Error('Delete failed'));
      });

      const response = await request(app).delete('/api/clients');
      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/clients/:id', () => {
    test('should delete existing client', async () => {
      mockDbGet(mockDb, { id: 1 });
      mockDbRun(mockDb);

      const response = await request(app).delete('/api/clients/1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Client deleted successfully' });
    });

    test('should return 404 if client not found', async () => {
      mockDbGet(mockDb, null);
      const response = await request(app).delete('/api/clients/999');
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
    });

    test('should return 400 for invalid client ID', async () => {
      const response = await request(app).delete('/api/clients/invalid');
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });

    test('should handle database delete error', async () => {
      mockDbGet(mockDb, { id: 1 });
      mockDbRun(mockDb, new Error('Delete failed'));

      const response = await request(app).delete('/api/clients/1');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete client' });
    });

    test('should handle database error when checking client existence', async () => {
      mockDbGet(mockDb, null, new Error('Database error'));
      const response = await request(app).delete('/api/clients/1');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });
});
