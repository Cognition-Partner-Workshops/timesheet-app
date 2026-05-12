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

function mockDbCallbacks(overrides = {}) {
  return {
    all: overrides.all || jest.fn(),
    get: overrides.get || jest.fn(),
    run: overrides.run || jest.fn(),
  };
}

function succeedAll(rows) {
  return jest.fn((q, p, cb) => cb(null, rows));
}
function succeedGet(row) {
  return jest.fn((q, p, cb) => cb(null, row));
}
function failDb(msg = 'Database error') {
  return jest.fn((q, p, cb) => cb(new Error(msg)));
}
function succeedRun(ctx = {}) {
  return jest.fn(function(q, p, cb) { Object.assign(this, ctx); cb.call(this, null); });
}
function failRun(msg = 'Database error') {
  return jest.fn(function(q, p, cb) { cb.call(this, new Error(msg)); });
}

const sampleProject = {
  id: 1, name: 'Project A', description: 'Desc A', client_id: 1,
  start_date: '2024-01-01', status: 'active', client_name: 'Client A',
  created_at: '2024-01-01', updated_at: '2024-01-01'
};

describe('Project Routes', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = mockDbCallbacks();
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => jest.clearAllMocks());

  describe('GET /api/projects', () => {
    it('returns all projects for the authenticated user', async () => {
      const projects = [sampleProject, { ...sampleProject, id: 2, name: 'Project B', status: 'on-hold', client_name: null }];
      mockDb.all = succeedAll(projects);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects });
    });

    it('returns empty array when none exist', async () => {
      mockDb.all = succeedAll([]);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: [] });
    });

    it('handles database errors', async () => {
      mockDb.all = failDb();
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('returns a specific project', async () => {
      mockDb.get = succeedGet(sampleProject);
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ project: sampleProject });
    });

    it('returns 404 when not found', async () => {
      mockDb.get = succeedGet(null);
      const res = await request(app).get('/api/projects/999');
      expect(res.status).toBe(404);
    });

    it('rejects non-numeric ID', async () => {
      const res = await request(app).get('/api/projects/abc');
      expect(res.status).toBe(400);
    });

    it('handles database errors', async () => {
      mockDb.get = failDb();
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    it('creates a project with all fields', async () => {
      mockDb.run = succeedRun({ lastID: 1 });
      mockDb.get = succeedGet(sampleProject);
      const res = await request(app).post('/api/projects').send({ name: 'Project A', description: 'Desc A', clientId: 1, startDate: '2024-01-01', status: 'active' });
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
      expect(res.body.project).toEqual(sampleProject);
    });

    it('creates a project with only the required name field', async () => {
      const minimal = { ...sampleProject, description: null, client_id: null, start_date: null, client_name: null };
      mockDb.run = succeedRun({ lastID: 3 });
      mockDb.get = succeedGet(minimal);
      const res = await request(app).post('/api/projects').send({ name: 'Minimal' });
      expect(res.status).toBe(201);
      expect(res.body.project.status).toBe('active');
    });

    it('rejects missing name', async () => {
      const res = await request(app).post('/api/projects').send({ description: 'No name' });
      expect(res.status).toBe(400);
    });

    it('rejects invalid status', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'X', status: 'bad' });
      expect(res.status).toBe(400);
    });

    it('handles insert failure', async () => {
      mockDb.run = failRun();
      const res = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(res.status).toBe(500);
    });

    it('handles retrieval failure after insert', async () => {
      mockDb.run = succeedRun({ lastID: 1 });
      mockDb.get = succeedGet(null);
      const res = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('failed to retrieve');
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('updates a project', async () => {
      const updated = { ...sampleProject, name: 'Updated', status: 'completed' };
      mockDb.get = jest.fn()
        .mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }))
        .mockImplementationOnce((q, p, cb) => cb(null, updated));
      mockDb.run = succeedRun();
      const res = await request(app).put('/api/projects/1').send({ name: 'Updated', status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.project).toEqual(updated);
    });

    it('returns 404 when project does not exist', async () => {
      mockDb.get = succeedGet(null);
      const res = await request(app).put('/api/projects/999').send({ name: 'X' });
      expect(res.status).toBe(404);
    });

    it('rejects non-numeric ID', async () => {
      const res = await request(app).put('/api/projects/abc').send({ name: 'X' });
      expect(res.status).toBe(400);
    });

    it('rejects empty body', async () => {
      const res = await request(app).put('/api/projects/1').send({});
      expect(res.status).toBe(400);
    });

    it('rejects invalid status', async () => {
      const res = await request(app).put('/api/projects/1').send({ status: 'bad' });
      expect(res.status).toBe(400);
    });

    it('handles existence check failure', async () => {
      mockDb.get = failDb();
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
    });

    it('handles update query failure', async () => {
      mockDb.get = jest.fn().mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run = failRun();
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
    });

    it('handles retrieval failure after update', async () => {
      mockDb.get = jest.fn()
        .mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }))
        .mockImplementationOnce((q, p, cb) => cb(null, null));
      mockDb.run = succeedRun();
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('failed to retrieve');
    });
  });

  describe('DELETE /api/projects', () => {
    it('deletes all projects', async () => {
      mockDb.run = succeedRun({ changes: 3 });
      const res = await request(app).delete('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.deletedCount).toBe(3);
    });

    it('handles database error', async () => {
      mockDb.run = failRun();
      const res = await request(app).delete('/api/projects');
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('deletes a specific project', async () => {
      mockDb.get = succeedGet({ id: 1 });
      mockDb.run = succeedRun();
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project deleted successfully');
    });

    it('returns 404 when not found', async () => {
      mockDb.get = succeedGet(null);
      const res = await request(app).delete('/api/projects/999');
      expect(res.status).toBe(404);
    });

    it('rejects non-numeric ID', async () => {
      const res = await request(app).delete('/api/projects/abc');
      expect(res.status).toBe(400);
    });

    it('handles existence check failure', async () => {
      mockDb.get = failDb();
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });

    it('handles delete query failure', async () => {
      mockDb.get = succeedGet({ id: 1 });
      mockDb.run = failRun();
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });
});
