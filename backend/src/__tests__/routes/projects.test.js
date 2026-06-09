const request = require('supertest');
const express = require('express');
const projectRoutes = require('../../routes/projects');
const helpers = require('../../database/helpers');

jest.mock('../../database/helpers');
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
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/projects', () => {
    test('returns all projects for authenticated user', async () => {
      const mockProjects = [
        { id: 1, name: 'Project A', status: 'active', client_name: 'Client A' },
        { id: 2, name: 'Project B', status: 'completed', client_name: null }
      ];
      helpers.dbAll.mockResolvedValue(mockProjects);

      const res = await request(app).get('/api/projects');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: mockProjects });
      expect(helpers.dbAll).toHaveBeenCalledWith(
        expect.stringContaining('FROM projects'),
        ['test@example.com']
      );
    });

    test('returns empty array when no projects', async () => {
      helpers.dbAll.mockResolvedValue([]);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: [] });
    });

    test('handles database error', async () => {
      helpers.dbAll.mockRejectedValue(new Error('DB failure'));
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/projects/:id', () => {
    test('returns specific project', async () => {
      const mockProject = { id: 1, name: 'Project A', status: 'active' };
      helpers.dbGet.mockResolvedValue(mockProject);

      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ project: mockProject });
    });

    test('returns 404 when not found', async () => {
      helpers.dbGet.mockResolvedValue(null);
      const res = await request(app).get('/api/projects/999');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Project not found' });
    });

    test('returns 400 for non-numeric ID', async () => {
      const res = await request(app).get('/api/projects/abc');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid project ID' });
    });

    test('handles database error', async () => {
      helpers.dbGet.mockRejectedValue(new Error('DB failure'));
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/projects', () => {
    test('creates project without client', async () => {
      const created = { id: 1, name: 'New Project', status: 'active', client_name: null };
      helpers.dbRun.mockResolvedValue({ lastID: 1 });
      helpers.dbGet.mockResolvedValue(created);

      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'New Project' });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
      expect(res.body.project).toEqual(created);
    });

    test('creates project with client assignment after ownership check', async () => {
      const created = { id: 1, name: 'P1', client_id: 5, client_name: 'Acme', status: 'active' };
      // verifyClientOwnership calls dbGet first
      helpers.dbGet.mockResolvedValueOnce({ id: 5 });
      helpers.dbRun.mockResolvedValue({ lastID: 1 });
      // fetch created project
      helpers.dbGet.mockResolvedValueOnce(created);

      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'P1', clientId: 5, startDate: '2024-03-01', status: 'on-hold' });

      expect(res.status).toBe(201);
      expect(res.body.project).toEqual(created);
    });

    test('returns 400 when assigned client not owned by user', async () => {
      helpers.dbGet.mockResolvedValue(null); // client lookup fails

      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'P1', clientId: 999 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('returns 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ description: 'no name' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Validation error' });
    });

    test('returns 400 for invalid status value', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'P', status: 'bad' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Validation error' });
    });

    test('handles database error on insert', async () => {
      helpers.dbRun.mockRejectedValue(new Error('DB failure'));

      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'P' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to create project' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('updates project fields', async () => {
      const updated = { id: 1, name: 'Renamed', status: 'completed' };
      helpers.dbGet.mockResolvedValueOnce({ id: 1 }); // ownership
      helpers.buildDynamicUpdate.mockReturnValue({ query: 'UPDATE ...', values: [] });
      helpers.dbRun.mockResolvedValue({ changes: 1 });
      helpers.dbGet.mockResolvedValueOnce(updated); // fetch after update

      const res = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Renamed', status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project updated successfully');
      expect(res.body.project).toEqual(updated);
    });

    test('returns 404 when project not found', async () => {
      helpers.dbGet.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/projects/99')
        .send({ name: 'X' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Project not found' });
    });

    test('returns 400 for non-numeric ID', async () => {
      const res = await request(app)
        .put('/api/projects/abc')
        .send({ name: 'X' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid project ID' });
    });

    test('returns 400 for empty body', async () => {
      const res = await request(app)
        .put('/api/projects/1')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Validation error' });
    });

    test('returns 400 when updated client not owned by user', async () => {
      helpers.dbGet.mockResolvedValueOnce({ id: 1 }); // project exists
      helpers.dbGet.mockResolvedValueOnce(null); // client not found

      const res = await request(app)
        .put('/api/projects/1')
        .send({ clientId: 999 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('handles database error during update', async () => {
      helpers.dbGet.mockResolvedValueOnce({ id: 1 });
      helpers.buildDynamicUpdate.mockReturnValue({ query: 'UPDATE ...', values: [] });
      helpers.dbRun.mockRejectedValue(new Error('DB failure'));

      const res = await request(app)
        .put('/api/projects/1')
        .send({ name: 'X' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to update project' });
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('deletes existing project', async () => {
      helpers.dbGet.mockResolvedValue({ id: 1 });
      helpers.dbRun.mockResolvedValue({ changes: 1 });

      const res = await request(app).delete('/api/projects/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Project deleted successfully' });
    });

    test('returns 404 when project not found', async () => {
      helpers.dbGet.mockResolvedValue(null);
      const res = await request(app).delete('/api/projects/99');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Project not found' });
    });

    test('returns 400 for non-numeric ID', async () => {
      const res = await request(app).delete('/api/projects/abc');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid project ID' });
    });

    test('handles database error on ownership check', async () => {
      helpers.dbGet.mockRejectedValue(new Error('DB failure'));
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to delete project' });
    });

    test('handles database error on delete', async () => {
      helpers.dbGet.mockResolvedValue({ id: 1 });
      helpers.dbRun.mockRejectedValue(new Error('DB failure'));
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to delete project' });
    });
  });
});
