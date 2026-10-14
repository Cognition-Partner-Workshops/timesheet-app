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

describe('Work Entry Routes', () => {
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

  describe('GET /api/work-entries', () => {
    test('should return all work entries for user', async () => {
      const mockEntries = [
        { id: 1, client_id: 1, hours: 5, description: 'Work 1', date: '2024-01-01', client_name: 'Client A' },
        { id: 2, client_id: 2, hours: 3, description: 'Work 2', date: '2024-01-02', client_name: 'Client B' }
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockEntries);
      });

      const response = await request(app).get('/api/work-entries');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ workEntries: mockEntries });
    });

    test('should filter by client ID when provided', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        expect(params).toEqual(['test@example.com', 1]);
        callback(null, []);
      });

      await request(app).get('/api/work-entries?clientId=1');

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND we.client_id = ?'),
        ['test@example.com', 1],
        expect.any(Function)
      );
    });

    test('should return 400 for invalid client ID filter', async () => {
      const response = await request(app).get('/api/work-entries?clientId=invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });

    test('should handle database error', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/work-entries');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/work-entries/:id', () => {
    test('should return specific work entry', async () => {
      const mockEntry = { id: 1, client_id: 1, hours: 5, description: 'Work', client_name: 'Client A' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockEntry);
      });

      const response = await request(app).get('/api/work-entries/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ workEntry: mockEntry });
    });

    test('should return 404 if work entry not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).get('/api/work-entries/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Work entry not found' });
    });

    test('should return 400 for invalid work entry ID', async () => {
      const response = await request(app).get('/api/work-entries/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid work entry ID' });
    });
  });

  describe('POST /api/work-entries', () => {
    test('should create work entry with valid data', async () => {
      const newEntry = {
        clientId: 1,
        hours: 5.5,
        description: 'Development work',
        date: '2024-01-15'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('clients')) {
          callback(null, { id: 1 }); // Client exists
        } else {
          callback(null, { id: 1, ...newEntry, client_name: 'Client A' });
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
      expect(response.body.message).toBe('Work entry created successfully');
    });

    test('should return 400 if client not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null); // Client doesn't exist
      });

      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 999,
          hours: 5,
          date: '2024-01-15'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/work-entries')
        .send({ hours: 5 });

      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid hours', async () => {
      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: -5,
          date: '2024-01-15'
        });

      expect(response.status).toBe(400);
    });

    test('should return 400 for hours exceeding 24', async () => {
      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 25,
          date: '2024-01-15'
        });

      expect(response.status).toBe(400);
    });

    test('should handle database error on insert', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Insert failed'));
      });

      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 5,
          date: '2024-01-15'
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create work entry' });
    });
  });

  describe('PUT /api/work-entries/:id', () => {
    test('should update work entry hours', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('work_entries we')) {
          callback(null, { id: 1, hours: 8, client_name: 'Client A' });
        } else {
          callback(null, { id: 1 });
        }
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ hours: 8 });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Work entry updated successfully');
    });

    test('should update work entry client', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ clientId: 2 });

      expect(response.status).toBe(200);
    });

    test('should return 404 if work entry not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .put('/api/work-entries/999')
        .send({ hours: 8 });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Work entry not found' });
    });

    test('should return 400 for invalid work entry ID', async () => {
      const response = await request(app)
        .put('/api/work-entries/invalid')
        .send({ hours: 8 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid work entry ID' });
    });

    test('should return 400 for empty update', async () => {
      const response = await request(app)
        .put('/api/work-entries/1')
        .send({});

      expect(response.status).toBe(400);
    });

    test('should return 400 if new client not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('work_entries')) {
          callback(null, { id: 1 });
        } else {
          callback(null, null); // Client doesn't exist
        }
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ clientId: 999 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
    });
  });

  describe('DELETE /api/work-entries/:id', () => {
    test('should delete existing work entry', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app).delete('/api/work-entries/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Work entry deleted successfully' });
    });

    test('should return 404 if work entry not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).delete('/api/work-entries/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Work entry not found' });
    });

    test('should return 400 for invalid work entry ID', async () => {
      const response = await request(app).delete('/api/work-entries/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid work entry ID' });
    });

    test('should handle database delete error', async () => {
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

    test('should handle database error when checking work entry existence', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).delete('/api/work-entries/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/work-entries/:id - Error Handling', () => {
    test('should handle database error when fetching single work entry', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/work-entries/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/work-entries - Error Handling', () => {
    test('should handle database error when verifying client', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app)
        .post('/api/work-entries')
        .send({
          clientId: 1,
          hours: 5,
          date: '2024-01-15'
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle error retrieving work entry after creation', async () => {
      let getCallCount = 0;
      mockDb.get.mockImplementation((query, params, callback) => {
        getCallCount++;
        if (getCallCount === 1) {
          callback(null, { id: 1 });
        } else {
          callback(new Error('Retrieval failed'), null);
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
          hours: 5,
          date: '2024-01-15'
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Work entry created but failed to retrieve' });
    });
  });

  describe('PUT /api/work-entries/:id - Error Handling', () => {
    test('should handle database error when checking work entry existence', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ hours: 8 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error when verifying new client in update', async () => {
      let callCount = 0;
      mockDb.get.mockImplementation((query, params, callback) => {
        callCount++;
        if (callCount === 1) {
          callback(null, { id: 1 });
        } else {
          callback(new Error('Database error'), null);
        }
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ clientId: 2 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error during update', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Update failed'));
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ hours: 8 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update work entry' });
    });

    test('should handle error retrieving work entry after update', async () => {
      let getCallCount = 0;
      mockDb.get.mockImplementation((query, params, callback) => {
        getCallCount++;
        if (getCallCount === 1) {
          callback(null, { id: 1 });
        } else {
          callback(new Error('Retrieval failed'), null);
        }
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ hours: 8 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Work entry updated but failed to retrieve' });
    });

    test('should update work entry date', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('work_entries we')) {
          callback(null, { id: 1, date: '2024-02-01', client_name: 'Client A' });
        } else {
          callback(null, { id: 1 });
        }
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ date: '2024-02-01' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Work entry updated successfully');
    });

    test('should update work entry description', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('work_entries we')) {
          callback(null, { id: 1, description: 'New description', client_name: 'Client A' });
        } else {
          callback(null, { id: 1 });
        }
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ description: 'New description' });

      expect(response.status).toBe(200);
    });

    test('should update description to null when empty string provided', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('work_entries we')) {
          callback(null, { id: 1, description: null, client_name: 'Client A' });
        } else {
          callback(null, { id: 1 });
        }
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ description: '' });

      expect(response.status).toBe(200);
    });

    test('should update multiple fields at once', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('work_entries we')) {
          callback(null, { id: 1, hours: 10, description: 'Updated', date: '2024-03-01', client_name: 'Client A' });
        } else {
          callback(null, { id: 1 });
        }
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ hours: 10, description: 'Updated', date: '2024-03-01' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Work entry updated successfully');
    });
  });

  describe('POST /api/work-entries - Unexpected Error', () => {
    test('should handle unexpected error in try-catch block', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected error');
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

  describe('PUT /api/work-entries/:id - Unexpected Error', () => {
    test('should handle unexpected error in try-catch block', async () => {
      getDatabase.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ hours: 8 });

      expect(response.status).toBe(500);
    });
  });

  describe('Mutation Testing - SQL Query and Parameter Verification', () => {
    test('GET / should query work_entries joined with clients using user_email', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      await request(app).get('/api/work-entries');

      const query = mockDb.all.mock.calls[0][0];
      const params = mockDb.all.mock.calls[0][1];
      expect(query).toContain('FROM work_entries we');
      expect(query).toContain('JOIN clients c ON we.client_id = c.id');
      expect(query).toContain('WHERE we.user_email = ?');
      expect(query).toContain('ORDER BY we.date DESC');
      expect(query).toContain('we.created_at DESC');
      expect(query).toContain('c.name as client_name');
      expect(params).toEqual(['test@example.com']);
    });

    test('GET / with clientId filter should append AND clause with parsed integer', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      await request(app).get('/api/work-entries?clientId=5');

      const query = mockDb.all.mock.calls[0][0];
      const params = mockDb.all.mock.calls[0][1];
      expect(query).toContain('AND we.client_id = ?');
      expect(params).toEqual(['test@example.com', 5]);
    });

    test('GET /:id should query with id and user_email params', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 3 });
      });

      await request(app).get('/api/work-entries/3');

      const query = mockDb.get.mock.calls[0][0];
      const params = mockDb.get.mock.calls[0][1];
      expect(query).toContain('FROM work_entries we');
      expect(query).toContain('JOIN clients c');
      expect(query).toContain('WHERE we.id = ?');
      expect(query).toContain('we.user_email = ?');
      expect(params).toEqual([3, 'test@example.com']);
    });

    test('POST / should verify client ownership before insert', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 2 });
      });
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 10;
        callback.call(this, null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 10 });
      });

      await request(app).post('/api/work-entries').send({
        clientId: 2, hours: 5, date: '2024-01-15'
      });

      const verifyQuery = mockDb.get.mock.calls[0][0];
      const verifyParams = mockDb.get.mock.calls[0][1];
      expect(verifyQuery).toContain('SELECT id FROM clients');
      expect(verifyQuery).toContain('WHERE id = ?');
      expect(verifyQuery).toContain('user_email');
      expect(verifyParams).toEqual([2, 'test@example.com']);
    });

    test('POST / should INSERT with correct columns and parameters', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 2 });
      });
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 10;
        callback.call(this, null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 10 });
      });

      await request(app).post('/api/work-entries').send({
        clientId: 2, hours: 5, description: 'Test work', date: '2024-01-15'
      });

      const insertQuery = mockDb.run.mock.calls[0][0];
      const insertParams = mockDb.run.mock.calls[0][1];
      expect(insertQuery).toContain('INSERT INTO work_entries');
      expect(insertQuery).toContain('client_id');
      expect(insertQuery).toContain('user_email');
      expect(insertQuery).toContain('hours');
      expect(insertQuery).toContain('description');
      expect(insertQuery).toContain('date');
      expect(insertParams[0]).toBe(2);
      expect(insertParams[1]).toBe('test@example.com');
      expect(insertParams[2]).toBe(5);
      expect(insertParams[3]).toBe('Test work');
      expect(insertParams).toHaveLength(5);
    });

    test('POST / should pass null for missing description', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      await request(app).post('/api/work-entries').send({
        clientId: 1, hours: 3, date: '2024-01-20'
      });

      const insertParams = mockDb.run.mock.calls[0][1];
      expect(insertParams[3]).toBeNull();
    });

    test('POST / should retrieve created entry using lastID with JOIN', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 55;
        callback.call(this, null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 55, client_name: 'Cl' });
      });

      const response = await request(app).post('/api/work-entries').send({
        clientId: 1, hours: 2, date: '2024-01-20'
      });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Work entry created successfully');

      const retrieveQuery = mockDb.get.mock.calls[1][0];
      const retrieveParams = mockDb.get.mock.calls[1][1];
      expect(retrieveQuery).toContain('FROM work_entries we');
      expect(retrieveQuery).toContain('JOIN clients c');
      expect(retrieveQuery).toContain('WHERE we.id = ?');
      expect(retrieveParams).toEqual([55]);
    });

    test('PUT /:id should check work entry exists with id and user_email', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 4 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 4 });
      });

      await request(app).put('/api/work-entries/4').send({ hours: 6 });

      const checkQuery = mockDb.get.mock.calls[0][0];
      const checkParams = mockDb.get.mock.calls[0][1];
      expect(checkQuery).toContain('SELECT id FROM work_entries');
      expect(checkQuery).toContain('WHERE id = ?');
      expect(checkQuery).toContain('user_email');
      expect(checkParams).toEqual([4, 'test@example.com']);
    });

    test('PUT /:id should build UPDATE with only hours field', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1, hours: 8 });
      });

      await request(app).put('/api/work-entries/1').send({ hours: 8 });

      const updateQuery = mockDb.run.mock.calls[0][0];
      const updateParams = mockDb.run.mock.calls[0][1];
      expect(updateQuery).toContain('UPDATE work_entries SET');
      expect(updateQuery).toContain('hours = ?');
      expect(updateQuery).toContain('updated_at = CURRENT_TIMESTAMP');
      expect(updateQuery).toContain('WHERE id = ?');
      expect(updateQuery).toContain('user_email');
      expect(updateParams).toEqual([8, 1, 'test@example.com']);
    });

    test('PUT /:id should include description field and coerce empty to null', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      await request(app).put('/api/work-entries/1').send({ description: '' });

      const updateParams = mockDb.run.mock.calls[0][1];
      expect(updateParams[0]).toBeNull();
    });

    test('PUT /:id should include date field when provided', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      await request(app).put('/api/work-entries/1').send({ date: '2024-06-01' });

      const updateQuery = mockDb.run.mock.calls[0][0];
      const updateParams = mockDb.run.mock.calls[0][1];
      expect(updateQuery).toContain('date = ?');
      expect(updateParams[0]).toBeTruthy();
    });

    test('PUT /:id should include client_id field when clientId provided', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 5 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      await request(app).put('/api/work-entries/1').send({ clientId: 5 });

      const updateQuery = mockDb.run.mock.calls[0][0];
      const updateParams = mockDb.run.mock.calls[0][1];
      expect(updateQuery).toContain('client_id = ?');
      expect(updateParams[0]).toBe(5);
    });

    test('PUT /:id should verify new client ownership when clientId updated', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 7 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      await request(app).put('/api/work-entries/1').send({ clientId: 7 });

      const clientCheckQuery = mockDb.get.mock.calls[1][0];
      const clientCheckParams = mockDb.get.mock.calls[1][1];
      expect(clientCheckQuery).toContain('SELECT id FROM clients');
      expect(clientCheckQuery).toContain('WHERE id = ?');
      expect(clientCheckQuery).toContain('user_email');
      expect(clientCheckParams).toEqual([7, 'test@example.com']);
    });

    test('PUT /:id should retrieve updated entry with JOIN after update', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 9 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 9, hours: 4 });
      });

      await request(app).put('/api/work-entries/9').send({ hours: 4 });

      const retrieveQuery = mockDb.get.mock.calls[1][0];
      const retrieveParams = mockDb.get.mock.calls[1][1];
      expect(retrieveQuery).toContain('FROM work_entries we');
      expect(retrieveQuery).toContain('JOIN clients c');
      expect(retrieveQuery).toContain('WHERE we.id = ?');
      expect(retrieveParams).toEqual([9]);
    });

    test('DELETE /:id should check existence with correct params', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 6 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      await request(app).delete('/api/work-entries/6');

      const checkParams = mockDb.get.mock.calls[0][1];
      expect(checkParams).toEqual([6, 'test@example.com']);

      const deleteQuery = mockDb.run.mock.calls[0][0];
      const deleteParams = mockDb.run.mock.calls[0][1];
      expect(deleteQuery).toContain('DELETE FROM work_entries');
      expect(deleteQuery).toContain('WHERE id = ?');
      expect(deleteQuery).toContain('user_email');
      expect(deleteParams).toEqual([6, 'test@example.com']);
    });

    test('DELETE /:id should return exact success message', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app).delete('/api/work-entries/1');

      expect(response.body.message).toBe('Work entry deleted successfully');
    });
  });
});
