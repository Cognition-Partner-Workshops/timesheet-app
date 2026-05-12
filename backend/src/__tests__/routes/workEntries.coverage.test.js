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

describe('Work Entry Routes - Coverage Improvement', () => {
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

  describe('POST /api/work-entries - Catch Block (line 139)', () => {
    test('should handle unexpected error thrown during POST processing', async () => {
      // Force getDatabase to throw after validation passes
      let callCount = 0;
      getDatabase.mockImplementation(() => {
        callCount++;
        if (callCount > 1) {
          throw new Error('Unexpected runtime error');
        }
        return mockDb;
      });

      // The first call is during middleware, subsequent calls are in the handler
      // We need to make the error happen inside the try block after validation
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected runtime error');
      });

      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 5,
          date: '2024-01-15'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/work-entries/:id - Catch Block (line 256)', () => {
    test('should handle unexpected error thrown during PUT processing', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected runtime error');
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ hours: 8 });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/work-entries - Additional Edge Cases', () => {
    test('should create work entry without optional description', async () => {
      const newEntry = {
        clientId: 1,
        hours: 3,
        date: '2024-01-15'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('clients')) {
          callback(null, { id: 1 });
        } else {
          callback(null, { id: 1, client_id: 1, hours: 3, description: null, date: '2024-01-15', client_name: 'Client A' });
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/work-entries')
        .send(newEntry);

      expect(response.status).toBe(201);
    });

    test('should create work entry with empty description', async () => {
      const newEntry = {
        clientId: 1,
        hours: 2,
        description: '',
        date: '2024-01-15'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('clients')) {
          callback(null, { id: 1 });
        } else {
          callback(null, { id: 1, client_id: 1, hours: 2, description: null, date: '2024-01-15', client_name: 'Client A' });
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/work-entries')
        .send(newEntry);

      expect(response.status).toBe(201);
    });

    test('should reject work entry with zero hours', async () => {
      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 0,
          date: '2024-01-15'
        });

      expect(response.status).toBe(400);
    });

    test('should reject work entry with exactly 24 boundary hours', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('clients')) {
          callback(null, { id: 1 });
        } else {
          callback(null, { id: 1, hours: 24, client_name: 'Client A' });
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 24,
          date: '2024-01-15'
        });

      // 24 is the max, should be accepted
      expect(response.status).toBe(201);
    });

    test('should accept work entry with very small hours', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('clients')) {
          callback(null, { id: 1 });
        } else {
          callback(null, { id: 1, hours: 0.01, client_name: 'Client A' });
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 0.01,
          date: '2024-01-15'
        });

      expect(response.status).toBe(201);
    });

    test('should reject work entry with missing date', async () => {
      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 5
        });

      expect(response.status).toBe(400);
    });

    test('should reject work entry with non-ISO date format', async () => {
      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 5,
          date: '01-15-2024'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/work-entries - Edge Cases', () => {
    test('should return empty array when no work entries exist', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/work-entries');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ workEntries: [] });
    });

    test('should handle numeric string clientId filter', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/work-entries?clientId=42');

      expect(response.status).toBe(200);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND we.client_id = ?'),
        ['test@example.com', 42],
        expect.any(Function)
      );
    });

    test('should handle clientId filter with zero', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/work-entries?clientId=0');

      expect(response.status).toBe(200);
    });
  });

  describe('PUT /api/work-entries/:id - Update with New Client Validation', () => {
    test('should update work entry with new valid client and other fields', async () => {
      let getCallCount = 0;
      mockDb.get.mockImplementation((query, params, callback) => {
        getCallCount++;
        if (getCallCount === 1) {
          // Check work entry exists
          callback(null, { id: 1 });
        } else if (getCallCount === 2) {
          // Check new client exists
          callback(null, { id: 2 });
        } else {
          // Return updated work entry
          callback(null, { id: 1, client_id: 2, hours: 10, description: 'Updated', client_name: 'Client B' });
        }
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ clientId: 2, hours: 10, description: 'Updated' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Work entry updated successfully');
    });
  });

  describe('DELETE /api/work-entries/:id - Edge Cases', () => {
    test('should handle deleting work entry with ID 0', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).delete('/api/work-entries/0');

      expect(response.status).toBe(404);
    });

    test('should handle negative work entry ID', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).delete('/api/work-entries/-1');

      expect(response.status).toBe(404);
    });
  });
});
