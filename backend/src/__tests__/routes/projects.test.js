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
  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

describe('Project Routes', () => {
  let mockDb;

  // Mock-builder helpers keep each test compact and avoid repeated callback wiring.
  const onAll = (rows, err = null) => mockDb.all.mockImplementation((q, p, cb) => cb(err, rows));
  const onGet = (row, err = null) => mockDb.get.mockImplementation((q, p, cb) => cb(err, row));
  const onGetOnce = (row, err = null) => mockDb.get.mockImplementationOnce((q, p, cb) => cb(err, row));
  const onRun = (ctx = {}, err = null) =>
    mockDb.run.mockImplementation(function (q, p, cb) {
      Object.assign(this, ctx);
      cb.call(this, err);
    });

  beforeEach(() => {
    mockDb = { all: jest.fn(), get: jest.fn(), run: jest.fn() };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => jest.clearAllMocks());

  describe('GET /api/projects', () => {
    test('returns all projects for the authenticated user', async () => {
      const rows = [
        { id: 1, name: 'Project A', description: 'Desc A', client_id: 1, start_date: '2024-01-01', status: 'active', client_name: 'Client A', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, name: 'Project B', description: 'Desc B', client_id: null, start_date: null, status: 'completed', client_name: null, created_at: '2024-01-02', updated_at: '2024-01-02' }
      ];
      onAll(rows);

      const res = await request(app).get('/api/projects');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: rows });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('FROM projects'),
        ['test@example.com'],
        expect.any(Function)
      );
    });

    test('returns an empty list when the user has no projects', async () => {
      onAll([]);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: [] });
    });

    test('responds 500 on a database error', async () => {
      onAll(null, new Error('boom'));
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/projects/:id', () => {
    test('returns a single project by id', async () => {
      const project = { id: 1, name: 'Project A', description: 'Desc A', status: 'active' };
      onGet(project);
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ project });
    });

    test('responds 404 when the project is missing', async () => {
      onGet(null);
      const res = await request(app).get('/api/projects/999');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Project not found' });
    });

    test('responds 400 for a non-numeric id', async () => {
      const res = await request(app).get('/api/projects/invalid');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid project ID' });
    });

    test('responds 500 on a database error', async () => {
      onGet(null, new Error('boom'));
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/projects', () => {
    test('creates a project from a full payload', async () => {
      const created = { id: 1, name: 'New Project', description: 'New Description', client_id: 1, start_date: '2024-01-01', status: 'active', created_at: '2024-01-01', updated_at: '2024-01-01' };
      onRun({ lastID: 1 });
      onGet(created);

      const res = await request(app).post('/api/projects').send({
        name: 'New Project', description: 'New Description', clientId: 1, startDate: '2024-01-01', status: 'active'
      });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
      expect(res.body.project).toEqual(created);
    });

    test('creates a project when only the name is supplied', async () => {
      const created = { id: 1, name: 'Minimal Project', description: null, client_id: null, start_date: null, status: 'active' };
      onRun({ lastID: 1 });
      onGet(created);

      const res = await request(app).post('/api/projects').send({ name: 'Minimal Project' });

      expect(res.status).toBe(201);
      expect(res.body.project).toEqual(created);
    });

    test('defaults status to active when omitted', async () => {
      onRun({ lastID: 1 });
      onGet({ id: 1, name: 'P', status: 'active' });

      const res = await request(app).post('/api/projects').send({ name: 'P' });

      expect(res.status).toBe(201);
      const insertCall = mockDb.run.mock.calls.find((c) => /INSERT INTO projects/.test(c[0]));
      expect(insertCall[1]).toContain('active');
    });

    test.each([
      ['missing name', { description: 'No name provided' }],
      ['empty name', { name: '' }],
      ['invalid status', { name: 'Bad Status', status: 'archived' }],
    ])('rejects a %s payload with 400', async (_label, payload) => {
      const res = await request(app).post('/api/projects').send(payload);
      expect(res.status).toBe(400);
    });

    test('responds 500 when the insert fails', async () => {
      onRun({}, new Error('Insert failed'));
      const res = await request(app).post('/api/projects').send({ name: 'Test Project' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to create project' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    const stubUpdate = (returned) => {
      onGetOnce({ id: 1 });
      onRun({});
      onGetOnce(returned);
    };

    test('updates the project name', async () => {
      const updated = { id: 1, name: 'Updated Name', status: 'active' };
      stubUpdate(updated);

      const res = await request(app).put('/api/projects/1').send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project updated successfully');
      expect(res.body.project).toEqual(updated);
    });

    test('updates the project status', async () => {
      stubUpdate({ id: 1, name: 'Project', status: 'completed' });

      const res = await request(app).put('/api/projects/1').send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.project.status).toBe('completed');
    });

    test('responds 404 when the project is missing', async () => {
      onGet(null);
      const res = await request(app).put('/api/projects/999').send({ name: 'Updated' });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Project not found' });
    });

    test('responds 400 for a non-numeric id', async () => {
      const res = await request(app).put('/api/projects/invalid').send({ name: 'Updated' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid project ID' });
    });

    test.each([
      ['an empty body', {}],
      ['an invalid status', { status: 'archived' }],
    ])('responds 400 for %s', async (_label, payload) => {
      const res = await request(app).put('/api/projects/1').send(payload);
      expect(res.status).toBe(400);
    });

    test('responds 500 when the existence check errors', async () => {
      onGet(null, new Error('boom'));
      const res = await request(app).put('/api/projects/1').send({ name: 'Updated' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to update project' });
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('deletes an existing project', async () => {
      onGet({ id: 1 });
      onRun({});
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Project deleted successfully' });
    });

    test('responds 404 when the project is missing', async () => {
      onGet(null);
      const res = await request(app).delete('/api/projects/999');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Project not found' });
    });

    test('responds 400 for a non-numeric id', async () => {
      const res = await request(app).delete('/api/projects/invalid');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid project ID' });
    });

    test('responds 500 when the delete fails', async () => {
      onGet({ id: 1 });
      onRun({}, new Error('Delete failed'));
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to delete project' });
    });
  });

  describe('DELETE /api/projects', () => {
    test('deletes all projects for the user', async () => {
      onRun({ changes: 3 });
      const res = await request(app).delete('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'All projects deleted successfully', deletedCount: 3 });
    });

    test('responds 500 when the bulk delete fails', async () => {
      onRun({}, new Error('Delete failed'));
      const res = await request(app).delete('/api/projects');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to delete projects' });
    });
  });
});
