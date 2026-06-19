const request = require('supertest');
const express = require('express');
const projectRoutes = require('../../routes/projects');
const { dbAll, dbGet, dbRun, buildUpdateQuery } = require('../../database/helpers');

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
    test('should return all projects for authenticated user', async () => {
      const mockProjects = [
        { id: 1, name: 'Project A', description: 'Desc A', client_id: 1, start_date: '2024-01-01', status: 'active', client_name: 'Client A' },
        { id: 2, name: 'Project B', description: null, client_id: null, start_date: null, status: 'on-hold', client_name: null }
      ];
      dbAll.mockResolvedValue(mockProjects);

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: mockProjects });
      expect(dbAll).toHaveBeenCalledWith(expect.stringContaining('WHERE p.user_email'), ['test@example.com']);
    });

    test('should return empty array when no projects exist', async () => {
      dbAll.mockResolvedValue([]);

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: [] });
    });

    test('should handle database error', async () => {
      dbAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project', async () => {
      const mockProject = { id: 1, name: 'Project A', status: 'active', client_name: 'Client A' };
      dbGet.mockResolvedValue(mockProject);

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ project: mockProject });
    });

    test('should return 404 if project not found', async () => {
      dbGet.mockResolvedValue(null);

      const response = await request(app).get('/api/projects/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).get('/api/projects/invalid');
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
    });

    test('should handle database error', async () => {
      dbGet.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/projects', () => {
    test('should create new project with all fields', async () => {
      const createdProject = { id: 1, name: 'New Project', description: 'Desc', client_id: 1, start_date: '2024-01-15', status: 'active', client_name: 'Client A' };
      dbRun.mockResolvedValue({ lastID: 1 });
      dbGet.mockResolvedValue(createdProject);

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'New Project', description: 'Desc', clientId: 1, startDate: '2024-01-15', status: 'active' });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.project).toEqual(createdProject);
    });

    test('should create project with only name (defaults status to active)', async () => {
      const createdProject = { id: 2, name: 'Minimal', description: null, client_id: null, start_date: null, status: 'active', client_name: null };
      dbRun.mockResolvedValue({ lastID: 2 });
      dbGet.mockResolvedValue(createdProject);

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Minimal' });

      expect(response.status).toBe(201);
      expect(response.body.project.status).toBe('active');
    });

    test('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ description: 'No name' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Validation error' });
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Project', status: 'invalid-status' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Validation error' });
    });

    test('should handle database error on insert', async () => {
      dbRun.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'New Project' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create project' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project with valid data', async () => {
      const updatedProject = { id: 1, name: 'Updated', status: 'completed', client_name: 'Client A' };
      dbGet.mockResolvedValueOnce({ id: 1 });
      buildUpdateQuery.mockReturnValue({ query: 'UPDATE projects SET name = ? WHERE id = ? AND user_email = ?', values: ['Updated', 1, 'test@example.com'] });
      dbRun.mockResolvedValue({ changes: 1 });
      dbGet.mockResolvedValueOnce(updatedProject);

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated', status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project updated successfully');
      expect(response.body.project).toEqual(updatedProject);
    });

    test('should return 404 if project not found', async () => {
      dbGet.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/projects/999')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app)
        .put('/api/projects/invalid')
        .send({ name: 'Updated' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
    });

    test('should return 400 for empty body', async () => {
      const response = await request(app)
        .put('/api/projects/1')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Validation error' });
    });

    test('should return 400 for invalid status value', async () => {
      const response = await request(app)
        .put('/api/projects/1')
        .send({ status: 'bad-status' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Validation error' });
    });

    test('should handle database error', async () => {
      dbGet.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update project' });
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project successfully', async () => {
      dbGet.mockResolvedValue({ id: 1 });
      dbRun.mockResolvedValue({ changes: 1 });

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Project deleted successfully' });
    });

    test('should return 404 if project not found', async () => {
      dbGet.mockResolvedValue(null);

      const response = await request(app).delete('/api/projects/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).delete('/api/projects/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
    });

    test('should handle database error on existence check', async () => {
      dbGet.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete project' });
    });

    test('should handle database error on delete', async () => {
      dbGet.mockResolvedValue({ id: 1 });
      dbRun.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete project' });
    });
  });
});
