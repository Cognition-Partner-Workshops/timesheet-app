const request = require('supertest');
const express = require('express');
const projectRoutes = require('../../routes/projects');
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
app.use('/api/projects', projectRoutes);
app.use((err, req, res, next) => {
  if (err.isJoi) return res.status(400).json({ error: 'Validation error' });
  res.status(500).json({ error: 'Internal server error' });
});

function createMockDb() {
  return { all: jest.fn(), get: jest.fn(), run: jest.fn() };
}

function mockDbSuccess(mockFn, result) {
  mockFn.mockImplementationOnce((query, params, callback) => callback(null, result));
}

function mockDbError(mockFn) {
  mockFn.mockImplementationOnce((query, params, callback) => callback(new Error('Database error'), null));
}

function mockInsert(mockDb, lastID) {
  mockDb.run.mockImplementation(function(query, params, callback) {
    this.lastID = lastID;
    callback.call(this, null);
  });
}

function mockInsertError(mockDb) {
  mockDb.run.mockImplementation(function(query, params, callback) {
    callback.call(this, new Error('Database error'));
  });
}

function mockRunSuccess(mockDb) {
  mockDb.run.mockImplementation(function(query, params, callback) {
    callback.call(this, null);
  });
}

function mockRunError(mockDb) {
  mockDb.run.mockImplementation(function(query, params, callback) {
    callback.call(this, new Error('Database error'));
  });
}

const sampleProject = { id: 1, name: 'Project A', client_id: 1, status: 'active', client_name: 'Client A' };

describe('Project Routes', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => jest.clearAllMocks());

  describe('GET /api/projects', () => {
    test('returns all projects for authenticated user', async () => {
      const projects = [sampleProject, { ...sampleProject, id: 2, name: 'Project B', status: 'completed' }];
      mockDbSuccess(mockDb.all, projects);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects });
    });

    test('returns empty array when none exist', async () => {
      mockDbSuccess(mockDb.all, []);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: [] });
    });

    test('filters by clientId', async () => {
      mockDbSuccess(mockDb.all, []);
      await request(app).get('/api/projects?clientId=1');
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND p.client_id = ?'),
        ['test@example.com', 1],
        expect.any(Function)
      );
    });

    test('rejects invalid clientId filter', async () => {
      const res = await request(app).get('/api/projects?clientId=invalid');
      expect(res.status).toBe(400);
    });

    test('handles database error', async () => {
      mockDbError(mockDb.all);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('returns specific project', async () => {
      mockDbSuccess(mockDb.get, sampleProject);
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ project: sampleProject });
    });

    test('returns 404 when not found', async () => {
      mockDbSuccess(mockDb.get, null);
      const res = await request(app).get('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('rejects invalid ID', async () => {
      const res = await request(app).get('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('handles database error', async () => {
      mockDbError(mockDb.get);
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    test('creates project with valid data', async () => {
      mockDbSuccess(mockDb.get, { id: 1 }); // client exists
      mockInsert(mockDb, 1);
      mockDbSuccess(mockDb.get, sampleProject); // fetch created
      const res = await request(app).post('/api/projects').send({ name: 'New Project', clientId: 1 });
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
    });

    test('creates project with all optional fields', async () => {
      const body = { name: 'Full', description: 'Desc', clientId: 1, startDate: '2024-01-01',
        endDate: '2024-12-31', status: 'active', budgetHours: 100 };
      mockDbSuccess(mockDb.get, { id: 1 });
      mockInsert(mockDb, 1);
      mockDbSuccess(mockDb.get, { ...sampleProject, ...body });
      const res = await request(app).post('/api/projects').send(body);
      expect(res.status).toBe(201);
    });

    test('rejects when client not found', async () => {
      mockDbSuccess(mockDb.get, null);
      const res = await request(app).post('/api/projects').send({ name: 'Test', clientId: 999 });
      expect(res.status).toBe(400);
    });

    test('rejects missing required fields', async () => {
      const res = await request(app).post('/api/projects').send({ description: 'Missing name' });
      expect(res.status).toBe(400);
    });

    test('rejects invalid status', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'Test', clientId: 1, status: 'invalid' });
      expect(res.status).toBe(400);
    });

    test('handles db error on client check', async () => {
      mockDbError(mockDb.get);
      const res = await request(app).post('/api/projects').send({ name: 'Test', clientId: 1 });
      expect(res.status).toBe(500);
    });

    test('handles db error on insert', async () => {
      mockDbSuccess(mockDb.get, { id: 1 });
      mockInsertError(mockDb);
      const res = await request(app).post('/api/projects').send({ name: 'Test', clientId: 1 });
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('updates project', async () => {
      mockDbSuccess(mockDb.get, { id: 1 }); // project exists
      mockRunSuccess(mockDb);
      mockDbSuccess(mockDb.get, { ...sampleProject, status: 'completed' }); // fetch updated
      const res = await request(app).put('/api/projects/1').send({ name: 'Updated', status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project updated successfully');
    });

    test('returns 404 when not found', async () => {
      mockDbSuccess(mockDb.get, null);
      const res = await request(app).put('/api/projects/999').send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });

    test('rejects invalid ID', async () => {
      const res = await request(app).put('/api/projects/invalid').send({ name: 'Updated' });
      expect(res.status).toBe(400);
    });

    test('rejects empty body', async () => {
      const res = await request(app).put('/api/projects/1').send({});
      expect(res.status).toBe(400);
    });

    test('validates clientId when updating', async () => {
      mockDbSuccess(mockDb.get, { id: 1 }); // project exists
      mockDbSuccess(mockDb.get, null); // client not found
      const res = await request(app).put('/api/projects/1').send({ clientId: 999 });
      expect(res.status).toBe(400);
    });

    test('handles database error', async () => {
      mockDbError(mockDb.get);
      const res = await request(app).put('/api/projects/1').send({ name: 'Updated' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('deletes project', async () => {
      mockDbSuccess(mockDb.get, { id: 1 });
      mockRunSuccess(mockDb);
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Project deleted successfully' });
    });

    test('returns 404 when not found', async () => {
      mockDbSuccess(mockDb.get, null);
      const res = await request(app).delete('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('rejects invalid ID', async () => {
      const res = await request(app).delete('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('handles db error on check', async () => {
      mockDbError(mockDb.get);
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });

    test('handles db error on delete', async () => {
      mockDbSuccess(mockDb.get, { id: 1 });
      mockRunError(mockDb);
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });
});
