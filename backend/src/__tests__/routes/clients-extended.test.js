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

describe('Client Routes - Extended Coverage', () => {
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
        callback.call({ changes: 3 }, null);
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('All clients deleted successfully');
      expect(response.body.deletedCount).toBe(3);
    });

    test('should return zero deleted count when no clients exist', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body.deletedCount).toBe(0);
    });

    test('should handle database error when deleting all clients', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, new Error('Database error'));
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete clients' });
    });

    test('should only delete clients for the authenticated user email', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      await request(app).delete('/api/clients');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM clients WHERE user_email = ?'),
        ['test@example.com'],
        expect.any(Function)
      );
    });
  });

  describe('PUT /api/clients/:id - Email field update', () => {
    test('should update client email field', async () => {
      const updatedClient = {
        id: 1, name: 'Client', description: 'Desc', department: 'Eng',
        email: 'client@corp.com', created_at: '2024-01-01', updated_at: '2024-01-02'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT id FROM clients')) {
          callback(null, { id: 1 });
        } else {
          callback(null, updatedClient);
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ email: 'client@corp.com' });

      expect(response.status).toBe(200);
      expect(response.body.client.email).toBe('client@corp.com');
    });

    test('should set email to null when empty string provided', async () => {
      const updatedClient = {
        id: 1, name: 'Client', description: null, department: null,
        email: null, created_at: '2024-01-01', updated_at: '2024-01-02'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT id FROM clients')) {
          callback(null, { id: 1 });
        } else {
          callback(null, updatedClient);
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ email: '' });

      expect(response.status).toBe(200);
    });

    test('should handle database error after update succeeds but retrieval fails', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT id FROM clients')) {
          callback(null, { id: 1 });
        } else {
          callback(new Error('Retrieval failed'), null);
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

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

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, new Error('Update failed'));
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update client' });
    });

    test('should update department field', async () => {
      const updatedClient = {
        id: 1, name: 'Client', description: null, department: 'Engineering',
        email: null, created_at: '2024-01-01', updated_at: '2024-01-02'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT id FROM clients')) {
          callback(null, { id: 1 });
        } else {
          callback(null, updatedClient);
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ department: 'Engineering' });

      expect(response.status).toBe(200);
      expect(response.body.client.department).toBe('Engineering');
    });

    test('should set department to null when empty string provided', async () => {
      const updatedClient = {
        id: 1, name: 'Client', description: null, department: null,
        email: null, created_at: '2024-01-01', updated_at: '2024-01-02'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT id FROM clients')) {
          callback(null, { id: 1 });
        } else {
          callback(null, updatedClient);
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ department: '' });

      expect(response.status).toBe(200);
    });
  });

  describe('PUT /api/clients/:id - Error handling', () => {
    test('should handle synchronous errors via next(error)', async () => {
      // Force an error by making getDatabase throw
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'Test' });

      expect(response.status).toBe(500);
    });
  });
});
