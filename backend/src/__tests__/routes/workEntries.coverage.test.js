const request = require('supertest');
const { getDatabase } = require('../../database/init');
const workEntryRoutes = require('../../routes/workEntries');
const { setupMockDb, createTestApp, mockDbGet, mockDbAll } = require('../helpers/testSetup');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const app = createTestApp('/api/work-entries', workEntryRoutes);
const VALID_ENTRY = { clientId: 1, hours: 5, description: 'Work', date: '2024-01-15' };

describe('Work Entry Routes - Coverage Gaps', () => {
  let mockDb;

  beforeEach(() => { mockDb = setupMockDb(); });
  afterEach(() => { jest.clearAllMocks(); });

  describe('Try-catch error paths', () => {
    test('should handle unexpected throw in POST handler', async () => {
      getDatabase.mockImplementation(() => { throw new Error('Unexpected'); });
      const response = await request(app).post('/api/work-entries').send(VALID_ENTRY);
      expect(response.status).toBe(500);
    });

    test('should handle unexpected throw in PUT handler', async () => {
      getDatabase.mockImplementation(() => { throw new Error('Unexpected'); });
      const response = await request(app).put('/api/work-entries/1').send({ hours: 3 });
      expect(response.status).toBe(500);
    });
  });

  describe('PUT - Update with clientId change', () => {
    test('should verify new client exists when updating clientId', async () => {
      const updatedEntry = { id: 1, client_id: 2, hours: 5, client_name: 'Client B' };
      mockDb.get
        .mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }))   // entry exists
        .mockImplementationOnce((q, p, cb) => cb(null, { id: 2 }))   // new client exists
        .mockImplementationOnce((q, p, cb) => cb(null, updatedEntry)); // return updated
      mockDb.run.mockImplementation((q, p, cb) => cb(null));

      const response = await request(app).put('/api/work-entries/1').send({ clientId: 2 });
      expect(response.status).toBe(200);
      expect(response.body.workEntry).toEqual(updatedEntry);
    });

    test('should return 400 when updating to non-existent client', async () => {
      mockDb.get
        .mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }))
        .mockImplementationOnce((q, p, cb) => cb(null, null));

      const response = await request(app).put('/api/work-entries/1').send({ clientId: 999 });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Client not found or does not belong to user');
    });

    test('should handle database error when verifying new client', async () => {
      mockDb.get
        .mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }))
        .mockImplementationOnce((q, p, cb) => cb(new Error('DB error'), null));

      const response = await request(app).put('/api/work-entries/1').send({ clientId: 2 });
      expect(response.status).toBe(500);
    });
  });

  describe('PUT - performUpdate error paths', () => {
    test('should handle database error during update run', async () => {
      mockDbGet(mockDb, { id: 1 });
      mockDb.run.mockImplementation((q, p, cb) => cb(new Error('Update failed')));

      const response = await request(app).put('/api/work-entries/1').send({ hours: 3 });
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update work entry');
    });

    test('should handle error retrieving entry after update', async () => {
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation((q, p, cb) => cb(null));
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(new Error('Retrieval failed'), null));

      const response = await request(app).put('/api/work-entries/1').send({ hours: 3 });
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Work entry updated but failed to retrieve');
    });

    test('should update multiple fields at once', async () => {
      const updated = { id: 1, hours: 8, description: 'Updated', date: '2024-02-01', client_name: 'Client A' };
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation((q, p, cb) => cb(null));
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, updated));

      const response = await request(app)
        .put('/api/work-entries/1')
        .send({ hours: 8, description: 'Updated', date: '2024-02-01' });
      expect(response.status).toBe(200);
      expect(response.body.workEntry).toEqual(updated);
    });

    test('should set description to null when empty', async () => {
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation((q, p, cb) => cb(null));
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1, description: null }));

      const response = await request(app).put('/api/work-entries/1').send({ description: '' });
      expect(response.status).toBe(200);
    });
  });

  describe('POST - Error paths', () => {
    test('should handle database error when inserting work entry', async () => {
      mockDbGet(mockDb, { id: 1 }); // client exists
      mockDb.run.mockImplementation((q, p, cb) => cb(new Error('Insert failed')));

      const response = await request(app).post('/api/work-entries').send(VALID_ENTRY);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create work entry');
    });

    test('should handle error retrieving work entry after creation', async () => {
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 })); // client exists
      mockDb.run.mockImplementation(function (q, p, cb) {
        this.lastID = 1;
        cb.call(this, null);
      });
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(new Error('Retrieval failed'), null));

      const response = await request(app).post('/api/work-entries').send(VALID_ENTRY);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Work entry created but failed to retrieve');
    });

    test('should handle database error when checking client existence', async () => {
      mockDbGet(mockDb, null, new Error('DB error'));
      const response = await request(app).post('/api/work-entries').send(VALID_ENTRY);
      expect(response.status).toBe(500);
    });
  });

  describe('GET /:id and DELETE /:id - Error paths', () => {
    test('should handle database error when fetching work entry', async () => {
      mockDbGet(mockDb, null, new Error('DB error'));
      const response = await request(app).get('/api/work-entries/1');
      expect(response.status).toBe(500);
    });

    test('should handle database error when checking work entry for delete', async () => {
      mockDbGet(mockDb, null, new Error('DB error'));
      const response = await request(app).delete('/api/work-entries/1');
      expect(response.status).toBe(500);
    });

    test('should handle database error when deleting work entry', async () => {
      mockDbGet(mockDb, { id: 1 });
      mockDb.run.mockImplementation((q, p, cb) => cb(new Error('Delete failed')));
      const response = await request(app).delete('/api/work-entries/1');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete work entry');
    });
  });
});
