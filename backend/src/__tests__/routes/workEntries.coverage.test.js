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
app.use((err, req, res, next) => {
  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

describe('Work Entry Routes - Coverage Gaps', () => {
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

  describe('POST /api/work-entries - Unexpected error in try-catch', () => {
    test('should handle unexpected throw in post handler', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 5,
          description: 'Work',
          date: '2024-01-15'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/work-entries/:id - Unexpected error in try-catch', () => {
    test('should handle unexpected throw in put handler', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ hours: 3 });

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/work-entries/:id - Update with clientId change', () => {
    test('should verify new client exists when updating clientId', async () => {
      const updatedEntry = {
        id: 1,
        client_id: 2,
        hours: 5,
        description: 'Updated',
        date: '2024-01-15',
        client_name: 'Client B'
      };

      // First call: check work entry exists
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      // Second call: verify new client exists
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 2 });
      });

      // Third call: return updated entry
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, updatedEntry);
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ clientId: 2 });

      expect(response.status).toBe(200);
      expect(response.body.workEntry).toEqual(updatedEntry);
    });

    test('should return 400 when updating to non-existent client', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 }); // Work entry exists
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, null); // New client does not exist
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ clientId: 999 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Client not found or does not belong to user'
      });
    });

    test('should handle database error when verifying new client', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 }); // Work entry exists
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(new Error('Database error'), null); // DB error on client check
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ clientId: 2 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('PUT /api/work-entries/:id - performUpdate error paths', () => {
    test('should handle database error during update run', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 }); // Work entry exists
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Update failed'));
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ hours: 3 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update work entry' });
    });

    test('should handle error retrieving entry after update', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 }); // Work entry exists
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(new Error('Retrieval failed'), null);
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ hours: 3 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Work entry updated but failed to retrieve'
      });
    });

    test('should update multiple fields at once', async () => {
      const updatedEntry = {
        id: 1,
        client_id: 1,
        hours: 8,
        description: 'Updated description',
        date: '2024-02-01',
        client_name: 'Client A'
      };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 }); // Work entry exists
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, updatedEntry);
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({
          hours: 8,
          description: 'Updated description',
          date: '2024-02-01'
        });

      expect(response.status).toBe(200);
      expect(response.body.workEntry).toEqual(updatedEntry);
    });

    test('should set description to null when empty', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        expect(params).toContain(null);
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1, description: null });
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ description: '' });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/work-entries - Error paths', () => {
    test('should handle database error when inserting work entry', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 }); // Client exists
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Insert failed'));
      });

      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 5,
          description: 'Work',
          date: '2024-01-15'
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create work entry' });
    });

    test('should handle error retrieving work entry after creation', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 }); // Client exists
      });

      mockDb.run.mockImplementation(function (query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(new Error('Retrieval failed'), null);
      });

      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 5,
          description: 'Work',
          date: '2024-01-15'
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Work entry created but failed to retrieve'
      });
    });

    test('should handle database error when checking client existence', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 5,
          description: 'Work',
          date: '2024-01-15'
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/work-entries/:id - Database error', () => {
    test('should handle database error when fetching work entry', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/work-entries/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('DELETE /api/work-entries/:id - Error paths', () => {
    test('should handle database error when checking work entry existence', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).delete('/api/work-entries/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error when deleting work entry', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Delete failed'));
      });

      const response = await request(app).delete('/api/work-entries/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete work entry' });
    });
  });
});
