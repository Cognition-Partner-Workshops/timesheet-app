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
// Add error handler for Joi validation
app.use((err, req, res, next) => {
  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

describe('Work Entry Routes - Edge Cases', () => {
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

  describe('Hours boundary conditions', () => {
    const postEntry = (hours) =>
      request(app)
        .post('/api/work-entries')
        .send({ clientId: 1, hours, date: '2024-01-01' });

    const mockSuccessfulCreate = () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 10 }));
      mockDb.run.mockImplementation(function (query, params, callback) {
        callback.call({ lastID: 10 }, null);
      });
    };

    test('should accept the maximum of 24 hours', async () => {
      mockSuccessfulCreate();

      const response = await postEntry(24);

      expect(response.status).toBe(201);
    });

    test('should accept a fractional minimum above zero', async () => {
      mockSuccessfulCreate();

      const response = await postEntry(0.01);

      expect(response.status).toBe(201);
    });

    test.each([
      ['zero hours', 0],
      ['negative hours', -1],
      ['more than 24 hours', 24.5]
    ])('should reject %s', async (_label, hours) => {
      const response = await postEntry(hours);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Validation error' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/work-entries - clientId filter', () => {
    test('should return an empty list when the user has no entries', async () => {
      mockDb.all.mockImplementation((query, params, callback) => callback(null, []));

      const response = await request(app).get('/api/work-entries');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ workEntries: [] });
    });

    test('should ignore an empty clientId query parameter', async () => {
      mockDb.all.mockImplementation((query, params, callback) => callback(null, []));

      const response = await request(app).get('/api/work-entries?clientId=');

      expect(response.status).toBe(200);
      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).not.toContain('AND we.client_id = ?');
      expect(params).toEqual(['test@example.com']);
    });

    test('should reject a non-numeric clientId filter', async () => {
      const response = await request(app).get('/api/work-entries?clientId=abc');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
      expect(mockDb.all).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/work-entries/:id - client reassignment', () => {
    test('should reject reassignment to a client owned by another user', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 5 }))
        .mockImplementationOnce((query, params, callback) => callback(null, undefined));

      const response = await request(app)
        .put('/api/work-entries/5')
        .send({ clientId: 99 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should handle a database error while verifying the new client', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 5 }))
        .mockImplementationOnce((query, params, callback) => callback(new Error('Database error'), null));

      const response = await request(app)
        .put('/api/work-entries/5')
        .send({ clientId: 2 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should null out the description when an empty string is sent', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 5 }))
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 5, description: null }));
      mockDb.run.mockImplementation(function (query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/work-entries/5')
        .send({ description: '' });

      expect(response.status).toBe(200);
      const [, values] = mockDb.run.mock.calls[0];
      expect(values).toEqual([null, 5, 'test@example.com']);
    });

    test('should reject an update with no fields', async () => {
      const response = await request(app).put('/api/work-entries/5').send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Validation error' });
    });
  });
});
