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
      expect(response.body).toEqual({
        message: 'All clients deleted successfully',
        deletedCount: 3
      });
    });

    test('should return 0 deletedCount when no clients exist', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.changes = 0;
        callback.call(this, null);
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body.deletedCount).toBe(0);
    });

    test('should handle database error when deleting all clients', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Delete failed'));
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete clients' });
    });

    test('should call delete query with correct user email', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.changes = 0;
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

  describe('PUT /api/clients/:id - Additional Coverage', () => {
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
      expect(response.body.client).toEqual(updatedClient);
    });

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
      expect(response.body.client).toEqual(updatedClient);
    });

    test('should update all fields at once', async () => {
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
      const updatedClient = { id: 1, name: 'Client', department: null };

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
        .send({ department: '' });

      expect(response.status).toBe(200);
    });

    test('should set email to null when empty string provided', async () => {
      const updatedClient = { id: 1, name: 'Client', email: null };

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
        .send({ email: '' });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/clients - Additional Coverage', () => {
    test('should create client with all optional fields', async () => {
      const newClient = {
        name: 'Full Client',
        description: 'A description',
        department: 'Marketing',
        email: 'client@example.com'
      };
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
      expect(response.body.client).toEqual(createdClient);
    });

    test('should handle invalid email format', async () => {
      const response = await request(app)
        .post('/api/clients')
        .send({ name: 'Client', email: 'not-an-email' });

      expect(response.status).toBe(400);
    });
  });
});
