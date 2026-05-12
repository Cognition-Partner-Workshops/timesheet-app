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

describe('Client Routes - Coverage Gaps', () => {
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

  describe('PUT /api/clients/:id - email field update', () => {
    test('should update client email field', async () => {
      const updatedClient = { id: 1, name: 'Client', email: 'client@example.com' };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 }); // Client exists
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
        .send({ email: 'client@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.client.email).toBe('client@example.com');
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

  describe('PUT /api/clients/:id - department field update', () => {
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
  });

  describe('PUT /api/clients/:id - multiple field update including email and department', () => {
    test('should update all fields simultaneously', async () => {
      const updatedClient = {
        id: 1,
        name: 'New Name',
        description: 'New Desc',
        department: 'Sales',
        email: 'new@example.com'
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
          email: 'new@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.client).toEqual(updatedClient);
    });
  });

  describe('PUT /api/clients/:id - catch block', () => {
    test('should handle unexpected error in try-catch', async () => {
      // Make getDatabase throw to trigger catch block
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected crash');
      });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/clients/ - bulk delete', () => {
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

    test('should return success with zero deletedCount when no clients exist', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.changes = 0;
        callback.call(this, null);
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body.deletedCount).toBe(0);
    });

    test('should handle database error during bulk delete', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Bulk delete failed'));
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete clients' });
    });

    test('should only delete clients belonging to authenticated user', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        expect(query).toContain('WHERE user_email = ?');
        expect(params).toEqual(['test@example.com']);
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

  describe('POST /api/clients - catch block', () => {
    test('should handle unexpected error in try-catch', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected crash');
      });

      const response = await request(app)
        .post('/api/clients')
        .send({ name: 'Test Client' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/clients - edge cases', () => {
    test('should create client with all optional fields', async () => {
      const newClient = {
        name: 'Full Client',
        description: 'A description',
        department: 'Engineering',
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
      expect(response.body.client.department).toBe('Engineering');
      expect(response.body.client.email).toBe('client@example.com');
    });

    test('should return 400 for name exceeding max length', async () => {
      const response = await request(app)
        .post('/api/clients')
        .send({ name: 'A'.repeat(256) });

      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/clients')
        .send({ name: 'Client', email: 'not-an-email' });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/clients/:id - validation edge cases', () => {
    test('should return 400 for invalid email format in update', async () => {
      const response = await request(app)
        .put('/api/clients/1')
        .send({ email: 'invalid-email-format' });

      expect(response.status).toBe(400);
    });

    test('should return 400 for name exceeding max length in update', async () => {
      const response = await request(app)
        .put('/api/clients/1')
        .send({ name: 'A'.repeat(256) });

      expect(response.status).toBe(400);
    });
  });
});
