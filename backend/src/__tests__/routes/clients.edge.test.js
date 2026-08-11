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

describe('Client Routes - Bulk Delete and Edge Cases', () => {
  let mockDb;
  let consoleErrorSpy;

  beforeEach(() => {
    mockDb = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('DELETE /api/clients', () => {
    test('should delete all clients for the authenticated user', async () => {
      mockDb.run.mockImplementation(function (query, params, callback) {
        callback.call({ changes: 3 }, null);
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'All clients deleted successfully',
        deletedCount: 3
      });
      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM clients WHERE user_email = ?',
        ['test@example.com'],
        expect.any(Function)
      );
    });

    test('should report zero deletions when the user has no clients', async () => {
      mockDb.run.mockImplementation(function (query, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body.deletedCount).toBe(0);
    });

    test('should handle database error during bulk delete', async () => {
      mockDb.run.mockImplementation(function (query, params, callback) {
        callback.call({}, new Error('Database error'));
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete clients' });
    });

    test('should scope the bulk delete to the authenticated user only', async () => {
      mockDb.run.mockImplementation(function (query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      await request(app).delete('/api/clients');

      const [query, params] = mockDb.run.mock.calls[0];
      expect(query).toContain('WHERE user_email = ?');
      expect(params).toEqual(['test@example.com']);
    });
  });

  describe('PUT /api/clients/:id - optional field handling', () => {
    const mockExistingClient = (client = { id: 1 }) => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, client))
        .mockImplementationOnce((query, params, callback) =>
          callback(null, { id: 1, name: 'Client', description: null, department: null, email: null })
        );
      mockDb.run.mockImplementation(function (query, params, callback) {
        callback.call({ changes: 1 }, null);
      });
    };

    test('should update department and email fields', async () => {
      mockExistingClient();

      const response = await request(app)
        .put('/api/clients/1')
        .send({ department: 'Engineering', email: 'contact@acme.com' });

      expect(response.status).toBe(200);
      const [query, values] = mockDb.run.mock.calls[0];
      expect(query).toContain('department = ?');
      expect(query).toContain('email = ?');
      expect(values).toEqual([
        'Engineering',
        'contact@acme.com',
        1,
        'test@example.com'
      ]);
    });

    test('should null out department and email when empty strings are sent', async () => {
      mockExistingClient();

      const response = await request(app)
        .put('/api/clients/1')
        .send({ department: '', email: '' });

      expect(response.status).toBe(200);
      const [, values] = mockDb.run.mock.calls[0];
      expect(values).toEqual([null, null, 1, 'test@example.com']);
    });
  });

  describe('Boundary conditions', () => {
    test('should treat a leading-numeric client ID as its parsed integer', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));

      const response = await request(app).get('/api/clients/12abc');

      expect(response.status).toBe(404);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.any(String),
        [12, 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should return an empty list when the user has no clients', async () => {
      mockDb.all.mockImplementation((query, params, callback) => callback(null, []));

      const response = await request(app).get('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ clients: [] });
    });

    test('should reject a client name longer than the schema maximum', async () => {
      const response = await request(app)
        .post('/api/clients')
        .send({ name: 'a'.repeat(256) });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Validation error' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });
});
