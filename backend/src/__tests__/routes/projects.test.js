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

function mockDbError(mockDb, method) {
  mockDb[method].mockImplementation((query, params, callback) => {
    callback(new Error('Database error'), null);
  });
}

function mockDbResult(mockDb, method, result) {
  mockDb[method].mockImplementation((query, params, callback) => {
    callback(null, result);
  });
}

function mockDbInsert(mockDb, id) {
  mockDb.run.mockImplementation(function(query, params, callback) {
    this.lastID = id;
    callback.call(this, null);
  });
}

function mockDbRunSuccess(mockDb) {
  mockDb.run.mockImplementation((query, params, callback) => callback(null));
}

function mockDbRunError(mockDb, msg) {
  mockDb.run.mockImplementation((query, params, callback) => callback(new Error(msg)));
}

const sampleProject = {
  id: 1, name: 'Project A', description: 'Desc A',
  client_id: 1, start_date: '2024-01-01', status: 'active',
  client_name: 'Client A', created_at: '2024-01-01', updated_at: '2024-01-01'
};

describe('Project Routes', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    getDatabase.mockReturnValue(mockDb);
  });
  afterEach(() => jest.clearAllMocks());

  describe('GET /api/projects', () => {
    test('returns all projects for authenticated user', async () => {
      const projects = [sampleProject, { ...sampleProject, id: 2, name: 'Project B', status: 'on-hold', client_id: null, client_name: null }];
      mockDbResult(mockDb, 'all', projects);

      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects });
      expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('SELECT'), ['test@example.com'], expect.any(Function));
    });

    test('returns empty array when no projects exist', async () => {
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
      mockDbResult(mockDb, 'get', sampleProject);
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ project: sampleProject });
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
      mockDbResult(mockDb, 'get', sampleProject);

      const res = await request(app).post('/api/projects')
        .send({ name: 'Project A', description: 'Desc A', clientId: 1, startDate: '2024-01-01', status: 'active' });
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
      expect(res.body.project).toEqual(sampleProject);
    });

    test('creates project with only name', async () => {
      mockDbInsert(mockDb, 1);
      mockDbResult(mockDb, 'get', { ...sampleProject, description: null, client_id: null, client_name: null });

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
      mockDbRunError(mockDb, 'Insert failed');
      const res = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create project');
    });

    test('handles retrieval error after creation', async () => {
      mockDbInsert(mockDb, 1);
      mockDbError(mockDb, 'get');
      const res = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Project created but failed to retrieve');
    });
  });

  describe('PUT /api/projects/:id', () => {
    function mockExistsAndUpdate() {
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDbRunSuccess(mockDb);
    }

    test('updates project name', async () => {
      mockExistsAndUpdate();
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { ...sampleProject, name: 'Updated' }));

      const res = await request(app).put('/api/projects/1').send({ name: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project updated successfully');
    });

    test('updates project status', async () => {
      mockExistsAndUpdate();
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { ...sampleProject, status: 'completed' }));

      const res = await request(app).put('/api/projects/1').send({ status: 'completed' });
      expect(res.status).toBe(200);
    });

    test('updates multiple fields', async () => {
      mockExistsAndUpdate();
      const updated = { ...sampleProject, name: 'New', status: 'on-hold', client_id: 2 };
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, updated));

      const res = await request(app).put('/api/projects/1')
        .send({ name: 'New', status: 'on-hold', clientId: 2 });
      expect(res.status).toBe(200);
      expect(res.body.project).toEqual(updated);
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

    test('rejects empty update body', async () => {
      const res = await request(app).put('/api/projects/1').send({});
      expect(res.status).toBe(400);
    });

    test('rejects invalid status', async () => {
      const res = await request(app).put('/api/projects/1').send({ status: 'bad' });
      expect(res.status).toBe(400);
    });

    test('handles existence check error', async () => {
      mockDbError(mockDb, 'get');
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
    });

    test('handles update error', async () => {
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDbRunError(mockDb, 'Update failed');
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update project');
    });

    test('handles retrieval error after update', async () => {
      mockExistsAndUpdate();
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(new Error('fail'), null));
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Project updated but failed to retrieve');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('deletes existing project', async () => {
      mockDbResult(mockDb, 'get', { id: 1 });
      mockDbRunSuccess(mockDb);
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

    test('handles delete error', async () => {
      mockDbResult(mockDb, 'get', { id: 1 });
      mockDbRunError(mockDb, 'Delete failed');
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete project');
    });

    test('handles existence check error', async () => {
      mockDbError(mockDb, 'get');
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });
});
