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

const SAMPLE_PROJECT = {
  id: 1, name: 'Project A', description: 'Desc A',
  client_id: 1, client_name: 'Client A',
  start_date: '2024-01-01', status: 'active',
  created_at: '2024-01-01', updated_at: '2024-01-01'
};

function mockDbError(mockDb, method) {
  mockDb[method].mockImplementation((_q, _p, cb) => cb(new Error('DB error'), null));
}

function mockDbResult(mockDb, method, result) {
  mockDb[method].mockImplementation((_q, _p, cb) => cb(null, result));
}

function mockDbInsert(mockDb, insertId) {
  mockDb.run.mockImplementation(function(_q, _p, cb) {
    this.lastID = insertId;
    cb.call(this, null);
  });
}

describe('Project Routes', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = { all: jest.fn(), get: jest.fn(), run: jest.fn() };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => jest.clearAllMocks());

  describe('GET /api/projects', () => {
    test('returns all projects for authenticated user', async () => {
      const projects = [SAMPLE_PROJECT, { ...SAMPLE_PROJECT, id: 2, name: 'Project B', status: 'on-hold' }];
      mockDbResult(mockDb, 'all', projects);

      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects });
    });

    test('returns empty array when none exist', async () => {
      mockDbResult(mockDb, 'all', []);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: [] });
    });

    test('handles database error', async () => {
      mockDbError(mockDb, 'all');
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('returns specific project', async () => {
      mockDbResult(mockDb, 'get', SAMPLE_PROJECT);
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ project: SAMPLE_PROJECT });
    });

    test('returns 404 if not found', async () => {
      mockDbResult(mockDb, 'get', null);
      const res = await request(app).get('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).get('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('handles database error', async () => {
      mockDbError(mockDb, 'get');
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    test('creates project with all fields', async () => {
      mockDbInsert(mockDb, 1);
      mockDbResult(mockDb, 'get', SAMPLE_PROJECT);

      const res = await request(app).post('/api/projects')
        .send({ name: 'Project A', description: 'Desc A', clientId: 1, startDate: '2024-01-01', status: 'active' });
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
      expect(res.body.project).toEqual(SAMPLE_PROJECT);
    });

    test('creates project with name only (defaults to active)', async () => {
      mockDbInsert(mockDb, 1);
      mockDbResult(mockDb, 'get', { ...SAMPLE_PROJECT, description: null, client_id: null, client_name: null });

      const res = await request(app).post('/api/projects').send({ name: 'Minimal' });
      expect(res.status).toBe(201);
    });

    test('rejects missing name', async () => {
      const res = await request(app).post('/api/projects').send({ description: 'no name' });
      expect(res.status).toBe(400);
    });

    test('rejects empty name', async () => {
      const res = await request(app).post('/api/projects').send({ name: '' });
      expect(res.status).toBe(400);
    });

    test('rejects invalid status', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'Test', status: 'bad' });
      expect(res.status).toBe(400);
    });

    test('handles insert error', async () => {
      mockDb.run.mockImplementation((_q, _p, cb) => cb(new Error('fail')));
      const res = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create project');
    });

    test('handles retrieval error after insert', async () => {
      mockDbInsert(mockDb, 1);
      mockDbError(mockDb, 'get');
      const res = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Project created but failed to retrieve');
    });
  });

  describe('PUT /api/projects/:id', () => {
    function mockExistsAndUpdate(mockDb, returnedProject) {
      mockDb.get.mockImplementationOnce((_q, _p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation((_q, _p, cb) => cb(null));
      mockDb.get.mockImplementationOnce((_q, _p, cb) => cb(null, returnedProject));
    }

    test('updates project name', async () => {
      const updated = { ...SAMPLE_PROJECT, name: 'Updated' };
      mockExistsAndUpdate(mockDb, updated);

      const res = await request(app).put('/api/projects/1').send({ name: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project updated successfully');
      expect(res.body.project).toEqual(updated);
    });

    test('updates project status', async () => {
      mockExistsAndUpdate(mockDb, { ...SAMPLE_PROJECT, status: 'completed' });
      const res = await request(app).put('/api/projects/1').send({ status: 'completed' });
      expect(res.status).toBe(200);
    });

    test('returns 404 if not found', async () => {
      mockDbResult(mockDb, 'get', null);
      const res = await request(app).put('/api/projects/999').send({ name: 'X' });
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).put('/api/projects/invalid').send({ name: 'X' });
      expect(res.status).toBe(400);
    });

    test('returns 400 for empty body', async () => {
      const res = await request(app).put('/api/projects/1').send({});
      expect(res.status).toBe(400);
    });

    test('returns 400 for invalid status', async () => {
      const res = await request(app).put('/api/projects/1').send({ status: 'bad' });
      expect(res.status).toBe(400);
    });

    test('handles db error on existence check', async () => {
      mockDbError(mockDb, 'get');
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
    });

    test('handles db error on update run', async () => {
      mockDb.get.mockImplementationOnce((_q, _p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation((_q, _p, cb) => cb(new Error('fail')));
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update project');
    });

    test('handles db error on post-update retrieval', async () => {
      mockDb.get.mockImplementationOnce((_q, _p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation((_q, _p, cb) => cb(null));
      mockDb.get.mockImplementationOnce((_q, _p, cb) => cb(new Error('fail')));
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Project updated but failed to retrieve');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('deletes existing project', async () => {
      mockDbResult(mockDb, 'get', { id: 1 });
      mockDb.run.mockImplementation((_q, _p, cb) => cb(null));
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project deleted successfully');
    });

    test('returns 404 if not found', async () => {
      mockDbResult(mockDb, 'get', null);
      const res = await request(app).delete('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).delete('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('handles db error on existence check', async () => {
      mockDbError(mockDb, 'get');
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });

    test('handles db error on delete', async () => {
      mockDbResult(mockDb, 'get', { id: 1 });
      mockDb.run.mockImplementation((_q, _p, cb) => cb(new Error('fail')));
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete project');
    });
  });
});
