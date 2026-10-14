const request = require('supertest');
const express = require('express');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const clientRoutes = require('../../routes/clients');

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

describe('Client Routes - bulk delete and update branches', () => {
  let mockDb;
  let consoleErrorSpy;

  beforeEach(() => {
    mockDb = { all: jest.fn(), get: jest.fn(), run: jest.fn() };
    getDatabase.mockReturnValue(mockDb);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('DELETE /api/clients', () => {
    test('should delete all clients of the authenticated user and report the count', async () => {
      mockDb.run.mockImplementation(function (query, params, callback) {
        callback.call({ changes: 3 }, null);
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'All clients deleted successfully', deletedCount: 3 });
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

    test('should return 500 when the bulk delete fails', async () => {
      mockDb.run.mockImplementation(function (query, params, callback) {
        callback.call({}, new Error('Database error'));
      });

      const response = await request(app).delete('/api/clients');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete clients' });
    });
  });

  describe('PUT /api/clients/:id - partial update branches', () => {
    const givenExistingClient = () => {
      let getCall = 0;
      mockDb.get.mockImplementation((query, params, callback) => {
        getCall += 1;
        callback(null, getCall === 1 ? { id: 1 } : { id: 1, name: 'Acme', department: 'Legal', email: 'a@b.com' });
      });
      mockDb.run.mockImplementation(function (query, params, callback) {
        callback.call({ changes: 1 }, null);
      });
    };

    test('should update the department only', async () => {
      givenExistingClient();

      const response = await request(app).put('/api/clients/1').send({ department: 'Legal' });

      expect(response.status).toBe(200);
      expect(mockDb.run.mock.calls[0][0]).toBe(
        'UPDATE clients SET department = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?'
      );
      expect(mockDb.run.mock.calls[0][1]).toEqual(['Legal', 1, 'test@example.com']);
    });

    test('should update the email only', async () => {
      givenExistingClient();

      const response = await request(app).put('/api/clients/1').send({ email: 'billing@acme.com' });

      expect(response.status).toBe(200);
      expect(mockDb.run.mock.calls[0][1]).toEqual(['billing@acme.com', 1, 'test@example.com']);
    });

    test('should store empty department and email as null', async () => {
      givenExistingClient();

      const response = await request(app).put('/api/clients/1').send({ department: '', email: '' });

      expect(response.status).toBe(200);
      expect(mockDb.run.mock.calls[0][1]).toEqual([null, null, 1, 'test@example.com']);
    });
  });

  describe('unexpected failures are forwarded to the error handler', () => {
    test('POST should forward a synchronous failure', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Connection pool exhausted');
      });

      const response = await request(app).post('/api/clients').send({ name: 'Acme Corp' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    test('PUT should forward a synchronous failure', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Connection pool exhausted');
      });

      const response = await request(app).put('/api/clients/1').send({ name: 'Acme Corp' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });
});
