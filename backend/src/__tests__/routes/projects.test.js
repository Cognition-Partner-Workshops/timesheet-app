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
  client_id: 1, start_date: '2024-01-01', status: 'active',
  client_name: 'Client A', created_at: '2024-01-01', updated_at: '2024-01-01'
};

describe('Project Routes', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = { all: jest.fn(), get: jest.fn(), run: jest.fn() };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => jest.clearAllMocks());

  function mockDbAll(err, data) {
    mockDb.all.mockImplementation((q, p, cb) => cb(err, data));
  }
  function mockDbGet(err, data) {
    mockDb.get.mockImplementation((q, p, cb) => cb(err, data));
  }
  function mockDbGetOnce(err, data) {
    mockDb.get.mockImplementationOnce((q, p, cb) => cb(err, data));
  }
  function mockDbRun(err, lastID) {
    mockDb.run.mockImplementation(function(q, p, cb) {
      if (lastID !== undefined) this.lastID = lastID;
      cb.call(this, err);
    });
  }

  describe('GET /api/projects', () => {
    test('returns all projects for authenticated user', async () => {
      const projects = [SAMPLE_PROJECT, { ...SAMPLE_PROJECT, id: 2, name: 'Project B', status: 'completed' }];
      mockDbAll(null, projects);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.projects).toEqual(projects);
    });

    test('returns empty array when none exist', async () => {
      mockDbAll(null, []);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: [] });
    });

    test('handles database error', async () => {
      mockDbAll(new Error('DB fail'), null);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('returns specific project', async () => {
      mockDbGet(null, SAMPLE_PROJECT);
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ project: SAMPLE_PROJECT });
    });

    test('returns 404 when not found', async () => {
      mockDbGet(null, null);
      const res = await request(app).get('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).get('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('handles database error', async () => {
      mockDbGet(new Error('DB fail'), null);
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    test('creates project with all fields', async () => {
      mockDbRun(null, 1);
      mockDbGet(null, SAMPLE_PROJECT);
      const res = await request(app).post('/api/projects')
        .send({ name: 'Project A', description: 'Desc A', clientId: 1, startDate: '2024-01-01', status: 'active' });
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
      expect(res.body.project).toEqual(SAMPLE_PROJECT);
    });

    test('creates project with only name (defaults status to active)', async () => {
      const minimal = { ...SAMPLE_PROJECT, description: null, client_id: null, start_date: null, client_name: null };
      mockDbRun(null, 1);
      mockDbGet(null, minimal);
      const res = await request(app).post('/api/projects').send({ name: 'Minimal' });
      expect(res.status).toBe(201);
    });

    test('rejects missing name', async () => {
      const res = await request(app).post('/api/projects').send({ description: 'No name' });
      expect(res.status).toBe(400);
    });

    test('rejects invalid status', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'P', status: 'invalid' });
      expect(res.status).toBe(400);
    });

    test('handles insert error', async () => {
      mockDbRun(new Error('DB fail'));
      const res = await request(app).post('/api/projects').send({ name: 'P' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create project');
    });

    test('handles retrieve-after-insert error', async () => {
      mockDbRun(null, 1);
      mockDbGet(new Error('DB fail'), null);
      const res = await request(app).post('/api/projects').send({ name: 'P' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Project created but failed to retrieve');
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('updates project successfully', async () => {
      const updated = { ...SAMPLE_PROJECT, name: 'Updated', status: 'completed' };
      mockDbGetOnce(null, { id: 1 });
      mockDbRun(null);
      mockDbGetOnce(null, updated);
      const res = await request(app).put('/api/projects/1').send({ name: 'Updated', status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project updated successfully');
    });

    test('returns 404 when not found', async () => {
      mockDbGet(null, null);
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

    test('handles existence-check error', async () => {
      mockDbGet(new Error('DB fail'), null);
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
    });

    test('handles update error', async () => {
      mockDbGetOnce(null, { id: 1 });
      mockDbRun(new Error('DB fail'));
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update project');
    });

    test('handles retrieve-after-update error', async () => {
      mockDbGetOnce(null, { id: 1 });
      mockDbRun(null);
      mockDbGetOnce(new Error('DB fail'), null);
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Project updated but failed to retrieve');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('deletes successfully', async () => {
      mockDbGetOnce(null, { id: 1 });
      mockDbRun(null);
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project deleted successfully');
    });

    test('returns 404 when not found', async () => {
      mockDbGet(null, null);
      const res = await request(app).delete('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).delete('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('handles existence-check error', async () => {
      mockDbGet(new Error('DB fail'), null);
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });

    test('handles delete error', async () => {
      mockDbGetOnce(null, { id: 1 });
      mockDbRun(new Error('DB fail'));
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete project');
    });
  });
});
