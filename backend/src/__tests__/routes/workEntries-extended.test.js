const request = require('supertest');
const express = require('express');
const workEntryRoutes = require('../../routes/workEntries');
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
app.use('/api/work-entries', workEntryRoutes);
// Error handler to catch next(error) calls
app.use((err, req, res, next) => {
  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

describe('Work Entries Routes - Extended Coverage', () => {
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

  describe('POST /api/work-entries - Error handling (catch block)', () => {
    test('should handle synchronous errors via next(error) in POST', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 5,
          date: '2024-01-01',
          description: 'Test'
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('PUT /api/work-entries/:id - Error handling (catch block)', () => {
    test('should handle synchronous errors via next(error) in PUT', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({
          hours: 8,
          date: '2024-01-01'
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle invalid work entry ID in PUT', async () => {
      const response = await request(app)
        .put('/api/work-entries/invalid')
        .send({ hours: 5 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid work entry ID' });
    });
  });

  describe('PUT /api/work-entries/:id - Edge cases', () => {
    test('should update work entry with all fields', async () => {
      const updatedEntry = {
        id: 1, client_id: 1, hours: 8, description: 'Updated',
        date: '2024-01-02', user_email: 'test@example.com',
        created_at: '2024-01-01', updated_at: '2024-01-02'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT id FROM work_entries')) {
          callback(null, { id: 1 });
        } else if (query.includes('SELECT we.')) {
          callback(null, { ...updatedEntry, client_name: 'Client' });
        } else {
          callback(null, { id: 1 });
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({
          clientId: 1,
          hours: 8,
          description: 'Updated',
          date: '2024-01-02'
        });

      expect(response.status).toBe(200);
    });

    test('should return 404 when work entry not found for update', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .put('/api/work-entries/999')
        .send({ hours: 5 });

      expect(response.status).toBe(404);
    });

    test('should handle database error during update check', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ hours: 5 });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/work-entries/:id - Edge cases', () => {
    test('should handle invalid ID format', async () => {
      const response = await request(app).delete('/api/work-entries/abc');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid work entry ID' });
    });

    test('should return 404 when entry does not exist', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).delete('/api/work-entries/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Work entry not found' });
    });

    test('should handle database error during existence check', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('DB error'), null);
      });

      const response = await request(app).delete('/api/work-entries/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error during delete operation', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, new Error('Delete failed'));
      });

      const response = await request(app).delete('/api/work-entries/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete work entry' });
    });

    test('should successfully delete work entry', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app).delete('/api/work-entries/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Work entry deleted successfully' });
    });
  });

  describe('POST /api/work-entries - Boundary conditions', () => {
    test('should reject zero hours', async () => {
      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 0,
          date: '2024-01-01'
        });

      expect(response.status).toBe(400);
    });

    test('should reject negative hours', async () => {
      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: -1,
          date: '2024-01-01'
        });

      expect(response.status).toBe(400);
    });

    test('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/work-entries')
        .send({});

      expect(response.status).toBe(400);
    });

    test('should reject hours exceeding 24', async () => {
      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 25,
          date: '2024-01-01'
        });

      expect(response.status).toBe(400);
    });
  });
});
