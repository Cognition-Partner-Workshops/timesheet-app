const request = require('supertest');
const { getDatabase } = require('../../database/init');
const { createTestApp, setupMockDb } = require('../helpers/testSetup');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const workEntryRoutes = require('../../routes/workEntries');
const app = createTestApp('/api/work-entries', workEntryRoutes);

describe('Work Entry Routes - Coverage Gaps', () => {
  let mockDb;

  beforeEach(() => { mockDb = setupMockDb(getDatabase); });
  afterEach(() => { jest.clearAllMocks(); });

  function stubWorkEntryCreate(resultEntry) {
    mockDb.get.mockImplementation((q, p, cb) => {
      cb(null, q.includes('clients') ? { id: 1 } : resultEntry);
    });
    mockDb.run.mockImplementation(function(q, p, cb) {
      this.lastID = 1;
      cb.call(this, null);
    });
  }

  describe('POST /api/work-entries - catch block', () => {
    test('should handle unexpected error in try-catch during creation', async () => {
      getDatabase.mockImplementation(() => { throw new Error('Unexpected crash'); });

      const response = await request(app).post('/api/work-entries')
        .send({ clientId: 1, hours: 5, date: '2024-01-15' });
      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/work-entries/:id - catch block', () => {
    test('should handle unexpected error in try-catch during update', async () => {
      getDatabase.mockImplementation(() => { throw new Error('Unexpected crash'); });

      const response = await request(app).put('/api/work-entries/1').send({ hours: 8 });
      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/work-entries/:id - error paths', () => {
    test('should handle error retrieving work entry after update', async () => {
      mockDb.get.mockImplementation((q, p, cb) => {
        cb(q.includes('work_entries we') ? new Error('Retrieval failed') : null,
           q.includes('work_entries we') ? null : { id: 1 });
      });
      mockDb.run.mockImplementation((q, p, cb) => cb(null));

      const response = await request(app).put('/api/work-entries/1').send({ hours: 8 });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Work entry updated but failed to retrieve' });
    });

    test('should handle database error during update run', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation((q, p, cb) => cb(new Error('Update failed')));

      const response = await request(app).put('/api/work-entries/1').send({ hours: 8 });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update work entry' });
    });
  });

  describe('POST /api/work-entries - boundary values', () => {
    test.each([
      ['minimum valid hours (0.01)', 0.01],
      ['maximum valid hours (24)', 24]
    ])('should create work entry with %s', async (label, hours) => {
      stubWorkEntryCreate({ id: 1, hours, client_name: 'Client A' });

      const response = await request(app).post('/api/work-entries')
        .send({ clientId: 1, hours, date: '2024-01-15' });
      expect(response.status).toBe(201);
    });

    test('should create work entry without description', async () => {
      stubWorkEntryCreate({ id: 1, hours: 5, description: null, client_name: 'Client A' });

      const response = await request(app).post('/api/work-entries')
        .send({ clientId: 1, hours: 5, date: '2024-01-15' });
      expect(response.status).toBe(201);
    });
  });

  describe('POST /api/work-entries - validation failures', () => {
    test.each([
      ['zero hours', { clientId: 1, hours: 0, date: '2024-01-15' }],
      ['invalid date format', { clientId: 1, hours: 5, date: 'not-a-date' }],
      ['non-integer clientId', { clientId: 1.5, hours: 5, date: '2024-01-15' }],
      ['missing date', { clientId: 1, hours: 5 }]
    ])('should return 400 for %s', async (label, body) => {
      const response = await request(app).post('/api/work-entries').send(body);
      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/work-entries/:id - partial updates', () => {
    function stubUpdateSuccess(resultEntry) {
      mockDb.get.mockImplementation((q, p, cb) => {
        cb(null, q.includes('work_entries we') ? resultEntry : { id: 1 });
      });
      mockDb.run.mockImplementation((q, p, cb) => cb(null));
    }

    test.each([
      ['date only', { date: '2024-02-01' }],
      ['description only', { description: 'Updated desc' }],
      ['empty description (null)', { description: '' }],
      ['multiple fields', { hours: 8, description: 'New', date: '2024-02-01' }]
    ])('should update work entry with %s', async (label, body) => {
      stubUpdateSuccess({ id: 1, hours: 5, ...body, client_name: 'Client A' });

      const response = await request(app).put('/api/work-entries/1').send(body);
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/work-entries - edge cases', () => {
    test('should return empty array when no work entries exist', async () => {
      mockDb.all.mockImplementation((q, p, cb) => cb(null, []));

      const response = await request(app).get('/api/work-entries');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ workEntries: [] });
    });

    test('should filter with valid numeric clientId parameter', async () => {
      mockDb.all.mockImplementation((q, p, cb) => cb(null, []));

      const response = await request(app).get('/api/work-entries?clientId=5');
      expect(response.status).toBe(200);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND we.client_id = ?'),
        ['test@example.com', 5],
        expect.any(Function)
      );
    });
  });
});
