const request = require('supertest');
const express = require('express');
const clientRoutes = require('../../routes/clients');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/api/clients', clientRoutes);
// Add error handler for Joi validation
app.use((err, req, res, next) => {
  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

describe('Client Routes', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/clients', () => {
    test('should return all clients for authenticated user', async () => {
      const mockClients = [
        { id: 1, name: 'Client A', description: 'Desc A', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, name: 'Client B', description: 'Desc B', created_at: '2024-01-02', updated_at: '2024-01-02' }
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockClients);
      });

      const response = await request(app).get('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ clients: mockClients });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name, description'),
        ['test@example.com'],
        expect.any(Function)
      );
    });

    test('should return empty array when no clients exist', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ clients: [] });
    });

    test('should handle database error', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/clients');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/clients/:id', () => {
    test('should return specific client', async () => {
      const mockClient = { id: 1, name: 'Client A', description: 'Desc A' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      const response = await request(app).get('/api/clients/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ client: mockClient });
    });

    test('should return 404 if client not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

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
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/clients/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/clients', () => {
    test('should create new client with valid data', async () => {
      const newClient = { name: 'New Client', description: 'New Description' };
      const createdClient = { id: 1, ...newClient, created_at: '2024-01-01', updated_at: '2024-01-01' };

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, createdClient);
      });

      const response = await request(app)
        .post('/api/clients')
        .send(newClient);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Client created successfully');
      expect(response.body.client).toEqual(createdClient);
    });

    test('should create client without description', async () => {
      const newClient = { name: 'Client Without Desc' };
      const createdClient = { id: 1, name: 'Client Without Desc', description: null };

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, createdClient);
      });

      const response = await request(app)
        .post('/api/clients')
        .send(newClient);

      expect(response.status).toBe(201);
    });

    test('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/clients')
        .send({ description: 'No name provided' });

      expect(response.status).toBe(400);
    });

    test('should return 400 for empty name', async () => {
      const response = await request(app)
        .post('/api/clients')
        .send({ name: '' });

      expect(response.status).toBe(400);
    });

    test('should handle database insert error', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Insert failed'));
      });

      const response = await request(app)
        .post('/api/clients')
        .send({ name: 'Test Client' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create client' });
    });
  });

  describe('PUT /api/clients/:id', () => {
    test('should update client name', async () => {
      const updatedClient = { id: 1, name: 'Updated Name', description: 'Old Desc' };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 }); // Client exists
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, updatedClient);
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Client updated successfully');
      expect(response.body.client).toEqual(updatedClient);
    });

    test('should update client description', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1, name: 'Client', description: 'New Description' });
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ description: 'New Description' });

      expect(response.status).toBe(200);
    });

    test('should return 404 if client not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .put('/api/clients/999')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
    });

    test('should return 400 for invalid client ID', async () => {
      const response = await request(app)
        .put('/api/clients/invalid')
        .send({ name: 'Updated' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });

    test('should return 400 for empty update', async () => {
      const response = await request(app)
        .put('/api/clients/1')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/clients/:id', () => {
    test('should delete existing client', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app).delete('/api/clients/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Client deleted successfully' });
    });

    test('should return 404 if client not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

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
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Delete failed'));
      });

      const response = await request(app).delete('/api/clients/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete client' });
    });

    test('should handle database error when checking client existence', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).delete('/api/clients/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/clients - Error Handling', () => {
    test('should handle error retrieving client after creation', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Retrieval failed'), null);
      });

      const response = await request(app)
        .post('/api/clients')
        .send({ name: 'Test Client' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Client created but failed to retrieve' });
    });
  });

  describe('PUT /api/clients/:id - Error Handling', () => {
    test('should handle database error when checking client existence', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error during update', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Update failed'));
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update client' });
    });

    test('should handle error retrieving client after update', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(new Error('Retrieval failed'), null);
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Client updated but failed to retrieve' });
    });

    test('should update both name and description', async () => {
      const updatedClient = { id: 1, name: 'New Name', description: 'New Description' };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, updatedClient);
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'New Name', description: 'New Description' });

      expect(response.status).toBe(200);
      expect(response.body.client).toEqual(updatedClient);
    });

    test('should update description to null when empty string provided', async () => {
      const updatedClient = { id: 1, name: 'Client', description: null };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, updatedClient);
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ description: '' });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/clients (all)', () => {
    test('should delete all clients for user', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        const ctx = { changes: 3 };
        callback.call(ctx, null);
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('All clients deleted successfully');
      expect(response.body.deletedCount).toBe(3);
    });

    test('should handle database error when deleting all clients', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, new Error('Delete failed'));
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete clients' });
    });

    test('should return zero deletedCount when no clients exist', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        const ctx = { changes: 0 };
        callback.call(ctx, null);
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body.deletedCount).toBe(0);
    });
  });

  describe('PUT /api/clients/:id - Department and Email Fields', () => {
    test('should update client email', async () => {
      const updatedClient = { id: 1, name: 'Client', email: 'new@example.com' };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, updatedClient);
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ email: 'new@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.client.email).toBe('new@example.com');
    });

    test('should update client department', async () => {
      const updatedClient = { id: 1, name: 'Client', department: 'Engineering' };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, updatedClient);
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ department: 'Engineering' });

      expect(response.status).toBe(200);
      expect(response.body.client.department).toBe('Engineering');
    });

    test('should update all fields at once', async () => {
      const updatedClient = {
        id: 1, name: 'New Name', description: 'New Desc',
        department: 'Sales', email: 'sales@example.com'
      };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, updatedClient);
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'New Name', description: 'New Desc', department: 'Sales', email: 'sales@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.client).toEqual(updatedClient);
    });
  });

  describe('PUT /api/clients/:id - Unexpected Error', () => {
    test('should handle unexpected error in try-catch block', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'Updated' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/clients - Unexpected Error', () => {
    test('should handle unexpected error in try-catch block', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .post('/api/clients')
        .send({ name: 'Test Client' });

      expect(response.status).toBe(500);
    });
  });

  describe('Mutation Testing - SQL Query and Parameter Verification', () => {
    test('GET / should query clients table with user_email filter and ORDER BY', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      await request(app).get('/api/clients');

      const query = mockDb.all.mock.calls[0][0];
      const params = mockDb.all.mock.calls[0][1];
      expect(query).toContain('FROM clients');
      expect(query).toContain('WHERE user_email');
      expect(query).toContain('ORDER BY name');
      expect(query).toContain('id');
      expect(query).toContain('description');
      expect(query).toContain('department');
      expect(query).toContain('email');
      expect(query).toContain('created_at');
      expect(query).toContain('updated_at');
      expect(params).toEqual(['test@example.com']);
    });

    test('GET /:id should query with both id and user_email params', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 5 });
      });

      await request(app).get('/api/clients/5');

      const query = mockDb.get.mock.calls[0][0];
      const params = mockDb.get.mock.calls[0][1];
      expect(query).toContain('FROM clients');
      expect(query).toContain('WHERE id = ?');
      expect(query).toContain('user_email');
      expect(params).toEqual([5, 'test@example.com']);
    });

    test('POST / should INSERT with correct columns and parameter order', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test' });
      });

      await request(app).post('/api/clients').send({ name: 'Test' });

      const query = mockDb.run.mock.calls[0][0];
      const params = mockDb.run.mock.calls[0][1];
      expect(query).toContain('INSERT INTO clients');
      expect(query).toContain('name');
      expect(query).toContain('description');
      expect(query).toContain('department');
      expect(query).toContain('email');
      expect(query).toContain('user_email');
      expect(params[0]).toBe('Test');
      expect(params[4]).toBe('test@example.com');
    });

    test('POST / should pass null for optional fields when not provided', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      await request(app).post('/api/clients').send({ name: 'OnlyName' });

      const params = mockDb.run.mock.calls[0][1];
      expect(params).toEqual(['OnlyName', null, null, null, 'test@example.com']);
    });

    test('POST / should pass values for all provided fields', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      await request(app).post('/api/clients').send({
        name: 'Full Client',
        description: 'A desc',
        department: 'Eng',
        email: 'eng@test.com'
      });

      const params = mockDb.run.mock.calls[0][1];
      expect(params).toEqual(['Full Client', 'A desc', 'Eng', 'eng@test.com', 'test@example.com']);
    });

    test('POST / should retrieve created client using lastID', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 42;
        callback.call(this, null);
      });
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 42, name: 'Test' });
      });

      await request(app).post('/api/clients').send({ name: 'Test' });

      const getQuery = mockDb.get.mock.calls[0][0];
      const getParams = mockDb.get.mock.calls[0][1];
      expect(getQuery).toContain('WHERE id = ?');
      expect(getParams).toEqual([42]);
    });

    test('PUT /:id should check client exists with correct id and user_email', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 3 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 3, name: 'Up' });
      });

      await request(app).put('/api/clients/3').send({ name: 'Up' });

      const checkQuery = mockDb.get.mock.calls[0][0];
      const checkParams = mockDb.get.mock.calls[0][1];
      expect(checkQuery).toContain('SELECT id FROM clients');
      expect(checkQuery).toContain('WHERE id = ?');
      expect(checkQuery).toContain('user_email');
      expect(checkParams).toEqual([3, 'test@example.com']);
    });

    test('PUT /:id should build UPDATE query with only name field', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1, name: 'NewName' });
      });

      await request(app).put('/api/clients/1').send({ name: 'NewName' });

      const updateQuery = mockDb.run.mock.calls[0][0];
      const updateParams = mockDb.run.mock.calls[0][1];
      expect(updateQuery).toContain('UPDATE clients SET');
      expect(updateQuery).toContain('name = ?');
      expect(updateQuery).toContain('updated_at = CURRENT_TIMESTAMP');
      expect(updateQuery).toContain('WHERE id = ?');
      expect(updateQuery).toContain('user_email');
      expect(updateParams).toEqual(['NewName', 1, 'test@example.com']);
    });

    test('PUT /:id should include description field when provided', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      await request(app).put('/api/clients/1').send({ description: 'NewDesc' });

      const updateQuery = mockDb.run.mock.calls[0][0];
      const updateParams = mockDb.run.mock.calls[0][1];
      expect(updateQuery).toContain('description = ?');
      expect(updateParams[0]).toBe('NewDesc');
    });

    test('PUT /:id should coerce empty description to null', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      await request(app).put('/api/clients/1').send({ description: '' });

      const updateParams = mockDb.run.mock.calls[0][1];
      expect(updateParams[0]).toBeNull();
    });

    test('PUT /:id should include department and email fields when provided', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      await request(app).put('/api/clients/1').send({ department: 'Sales', email: 'sales@co.com' });

      const updateQuery = mockDb.run.mock.calls[0][0];
      const updateParams = mockDb.run.mock.calls[0][1];
      expect(updateQuery).toContain('department = ?');
      expect(updateQuery).toContain('email = ?');
      expect(updateParams[0]).toBe('Sales');
      expect(updateParams[1]).toBe('sales@co.com');
    });

    test('PUT /:id should coerce empty department and email to null', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      await request(app).put('/api/clients/1').send({ department: '', email: '' });

      const updateParams = mockDb.run.mock.calls[0][1];
      expect(updateParams[0]).toBeNull();
      expect(updateParams[1]).toBeNull();
    });

    test('PUT /:id should retrieve updated client by id after update', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 7 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 7, name: 'Upd' });
      });

      await request(app).put('/api/clients/7').send({ name: 'Upd' });

      const retrieveQuery = mockDb.get.mock.calls[1][0];
      const retrieveParams = mockDb.get.mock.calls[1][1];
      expect(retrieveQuery).toContain('SELECT');
      expect(retrieveQuery).toContain('FROM clients');
      expect(retrieveQuery).toContain('WHERE id = ?');
      expect(retrieveParams).toEqual([7]);
    });

    test('DELETE / should use correct DELETE query with user_email', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      await request(app).delete('/api/clients');

      const query = mockDb.run.mock.calls[0][0];
      const params = mockDb.run.mock.calls[0][1];
      expect(query).toContain('DELETE FROM clients');
      expect(query).toContain('WHERE user_email');
      expect(params).toEqual(['test@example.com']);
    });

    test('DELETE /:id should check existence then delete with correct params', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 2 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      await request(app).delete('/api/clients/2');

      const checkParams = mockDb.get.mock.calls[0][1];
      expect(checkParams).toEqual([2, 'test@example.com']);

      const deleteQuery = mockDb.run.mock.calls[0][0];
      const deleteParams = mockDb.run.mock.calls[0][1];
      expect(deleteQuery).toContain('DELETE FROM clients');
      expect(deleteQuery).toContain('WHERE id = ?');
      expect(deleteQuery).toContain('user_email');
      expect(deleteParams).toEqual([2, 'test@example.com']);
    });
  });
});
