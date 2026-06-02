const request = require('supertest');
const express = require('express');
const projectRoutes = require('../../routes/projects');
const helpers = require('../../database/helpers');

jest.mock('../../database/helpers');
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/projects', () => {
    test('should return all projects for authenticated user', async () => {
      const mockProjects = [
        { id: 1, name: 'Project A', client_id: 1, status: 'active', client_name: 'Client A' },
        { id: 2, name: 'Project B', client_id: 2, status: 'completed', client_name: 'Client B' }
      ];
      helpers.dbAll.mockResolvedValue(mockProjects);

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: mockProjects });
    });

    test('should return empty array when no projects exist', async () => {
      helpers.dbAll.mockResolvedValue([]);

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: [] });
    });

    test('should filter projects by clientId', async () => {
      helpers.dbAll.mockResolvedValue([{ id: 1, name: 'Project A', client_id: 1 }]);

      const response = await request(app).get('/api/projects?clientId=1');

      expect(response.status).toBe(200);
      expect(helpers.dbAll).toHaveBeenCalledWith(
        expect.stringContaining('AND p.client_id = ?'),
        ['test@example.com', 1]
      );
    });

    test('should filter projects by status', async () => {
      helpers.dbAll.mockResolvedValue([{ id: 1, name: 'Project A', status: 'active' }]);

      const response = await request(app).get('/api/projects?status=active');

      expect(response.status).toBe(200);
      expect(helpers.dbAll).toHaveBeenCalledWith(
        expect.stringContaining('AND p.status = ?'),
        ['test@example.com', 'active']
      );
    });

    test('should return 400 for invalid clientId', async () => {
      const response = await request(app).get('/api/projects?clientId=abc');
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app).get('/api/projects?status=invalid');
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid status. Must be one of: active, completed, on-hold' });
    });

    test('should handle database error', async () => {
      helpers.dbAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project', async () => {
      const mockProject = { id: 1, name: 'Project A', client_id: 1, status: 'active' };
      helpers.dbGet.mockResolvedValue(mockProject);

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ project: mockProject });
    });

    test('should return 404 if project not found', async () => {
      helpers.dbGet.mockResolvedValue(null);

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
      helpers.dbGet.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/projects', () => {
    test('should create new project with valid data', async () => {
      const createdProject = { id: 1, name: 'New Project', client_id: 1, status: 'active', client_name: 'Client A' };
      helpers.dbGet
        .mockResolvedValueOnce({ id: 1 })   // verifyClientOwnership
        .mockResolvedValueOnce(createdProject); // fetchProject
      helpers.dbRun.mockResolvedValue({ lastID: 1 });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'New Project', description: 'Description', clientId: 1, status: 'active' });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.project).toEqual(createdProject);
    });

    test('should create project with minimal required fields', async () => {
      const createdProject = { id: 1, name: 'Minimal', client_id: 1, status: 'active' };
      helpers.dbGet
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(createdProject);
      helpers.dbRun.mockResolvedValue({ lastID: 1 });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Minimal', clientId: 1 });

      expect(response.status).toBe(201);
      expect(response.body.project).toEqual(createdProject);
    });

    test('should return 400 if client does not exist', async () => {
      helpers.dbGet.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Project', clientId: 999 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ description: 'No name provided' });

      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Project', clientId: 1, status: 'invalid' });

      expect(response.status).toBe(400);
    });

    test('should handle database error on client check', async () => {
      helpers.dbGet.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Project', clientId: 1 });

      expect(response.status).toBe(500);
    });

    test('should handle database error on insert', async () => {
      helpers.dbGet.mockResolvedValueOnce({ id: 1 });
      helpers.dbRun.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Project', clientId: 1 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create project' });
    });

    test('should handle project created but failed to retrieve', async () => {
      helpers.dbGet
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(null);
      helpers.dbRun.mockResolvedValue({ lastID: 1 });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Project', clientId: 1 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project created but failed to retrieve' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project with valid data', async () => {
      const updatedProject = { id: 1, name: 'Updated', client_id: 1, status: 'completed' };
      helpers.dbGet
        .mockResolvedValueOnce({ id: 1 })   // check project exists
        .mockResolvedValueOnce(updatedProject); // fetchProject after update
      helpers.dbRun.mockResolvedValue({ changes: 1 });
      helpers.buildUpdateQuery.mockReturnValue({ query: 'UPDATE projects SET name = ? WHERE id = ? AND user_email = ?', values: ['Updated', 1, 'test@example.com'] });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated', status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project updated successfully');
      expect(response.body.project).toEqual(updatedProject);
    });

    test('should return 404 if project not found', async () => {
      helpers.dbGet.mockResolvedValue(null);

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

    test('should return 400 when no fields provided', async () => {
      const response = await request(app)
        .put('/api/projects/1')
        .send({});

      expect(response.status).toBe(400);
    });

    test('should validate client exists when updating clientId', async () => {
      helpers.dbGet
        .mockResolvedValueOnce({ id: 1 })  // project exists
        .mockResolvedValueOnce(null);        // client doesn't exist

      const response = await request(app)
        .put('/api/projects/1')
        .send({ clientId: 999 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('should handle database error on project check', async () => {
      helpers.dbGet.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated' });

      expect(response.status).toBe(500);
    });

    test('should handle database error on update', async () => {
      helpers.dbGet.mockResolvedValueOnce({ id: 1 });
      helpers.buildUpdateQuery.mockReturnValue({ query: 'UPDATE...', values: [] });
      helpers.dbRun.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update project' });
    });

    test('should handle project updated but failed to retrieve', async () => {
      helpers.dbGet
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(null);
      helpers.buildUpdateQuery.mockReturnValue({ query: 'UPDATE...', values: [] });
      helpers.dbRun.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project updated but failed to retrieve' });
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project', async () => {
      helpers.dbGet.mockResolvedValue({ id: 1 });
      helpers.dbRun.mockResolvedValue({ changes: 1 });

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Project deleted successfully' });
    });

    test('should return 404 if project not found', async () => {
      helpers.dbGet.mockResolvedValue(null);

      const response = await request(app).delete('/api/projects/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).delete('/api/projects/invalid');
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
    });

    test('should handle database error on project check', async () => {
      helpers.dbGet.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
    });

    test('should handle database error on delete', async () => {
      helpers.dbGet.mockResolvedValue({ id: 1 });
      helpers.dbRun.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete project' });
    });
  });
});
