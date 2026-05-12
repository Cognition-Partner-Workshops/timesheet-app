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
app.use((err, req, res, next) => {
  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

describe('Client Routes - Coverage Improvement', () => {
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

  describe('DELETE /api/clients (delete all)', () => {
    test('should delete all clients for authenticated user', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.changes = 3;
        callback.call(this, null);
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('All clients deleted successfully');
      expect(response.body.deletedCount).toBe(3);
    });

    test('should return 0 deleted count when no clients exist', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.changes = 0;
        callback.call(this, null);
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('All clients deleted successfully');
      expect(response.body.deletedCount).toBe(0);
    });

    test('should handle database error when deleting all clients', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Delete all failed'));
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete clients' });
    });

    test('should only delete clients belonging to authenticated user', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        expect(params).toEqual(['test@example.com']);
        expect(query).toContain('WHERE user_email = ?');
        this.changes = 1;
        callback.call(this, null);
      });

      await request(app).delete('/api/clients');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM clients WHERE user_email = ?'),
        ['test@example.com'],
        expect.any(Function)
      );
    });
  });

  describe('PUT /api/clients/:id - Department and Email Fields', () => {
    test('should update client department', async () => {
      const updatedClient = { id: 1, name: 'Client', department: 'Engineering' };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        expect(query).toContain('department = ?');
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

    test('should update client email', async () => {
      const updatedClient = { id: 1, name: 'Client', email: 'new@example.com' };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        expect(query).toContain('email = ?');
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

    test('should update all client fields simultaneously', async () => {
      const updatedClient = {
        id: 1,
        name: 'New Name',
        description: 'New Desc',
        department: 'Sales',
        email: 'sales@example.com'
      };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        expect(query).toContain('name = ?');
        expect(query).toContain('description = ?');
        expect(query).toContain('department = ?');
        expect(query).toContain('email = ?');
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, updatedClient);
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({
          name: 'New Name',
          description: 'New Desc',
          department: 'Sales',
          email: 'sales@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.client).toEqual(updatedClient);
    });

    test('should set department to null when empty string provided', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1, name: 'Client', department: null });
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ department: '' });

      expect(response.status).toBe(200);
    });

    test('should set email to null when empty string provided', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1, name: 'Client', email: null });
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ email: '' });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/clients - Additional Fields', () => {
    test('should create client with all optional fields', async () => {
      const newClient = {
        name: 'Full Client',
        description: 'Full description',
        department: 'Engineering',
        email: 'client@example.com'
      };
      const createdClient = { id: 1, ...newClient };

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        expect(params).toEqual([
          'Full Client',
          'Full description',
          'Engineering',
          'client@example.com',
          'test@example.com'
        ]);
        callback.call(this, null);
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, createdClient);
      });

      const response = await request(app)
        .post('/api/clients')
        .send(newClient);

      expect(response.status).toBe(201);
      expect(response.body.client).toEqual(createdClient);
    });

    test('should handle null optional fields on creation', async () => {
      const newClient = { name: 'Minimal Client' };
      const createdClient = { id: 1, name: 'Minimal Client', description: null, department: null, email: null };

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

    test('should handle unexpected error thrown in POST handler', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .post('/api/clients')
        .send({ name: 'Test Client' });

      expect(response.status).toBe(500);
    });

    test('should handle unexpected error thrown in PUT handler', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'Updated' });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/clients - Edge Cases', () => {
    test('should handle large number of clients', async () => {
      const mockClients = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        name: `Client ${i + 1}`,
        description: `Description ${i + 1}`
      }));

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockClients);
      });

      const response = await request(app).get('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body.clients).toHaveLength(50);
    });
  });

  describe('DELETE /api/clients/:id - Edge Cases', () => {
    test('should handle deleting client with ID 0', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).delete('/api/clients/0');

      expect(response.status).toBe(404);
    });

    test('should handle large client ID', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).delete('/api/clients/999999999');

      expect(response.status).toBe(404);
    });
  });
});
