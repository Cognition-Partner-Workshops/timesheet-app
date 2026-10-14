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

function expectStatus(response, code) {
  expect(response.status).toBe(code);
}

function expectError(response, code, message) {
  expectStatus(response, code);
  expect(response.body).toEqual({ error: message });
}

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

      expectStatus(response, 200);
      expect(response.body).toEqual({ projects: mockProjects });
    });

    test('should return empty array when no projects exist', async () => {
      helpers.dbAll.mockResolvedValue([]);
      const response = await request(app).get('/api/projects');
      expectStatus(response, 200);
      expect(response.body).toEqual({ projects: [] });
    });

    test('should filter projects by clientId', async () => {
      helpers.dbAll.mockResolvedValue([{ id: 1, name: 'Project A', client_id: 1 }]);
      const response = await request(app).get('/api/projects?clientId=1');
      expectStatus(response, 200);
      expect(helpers.dbAll).toHaveBeenCalledWith(
        expect.stringContaining('AND p.client_id = ?'),
        ['test@example.com', 1]
      );
    });

    test('should filter projects by status', async () => {
      helpers.dbAll.mockResolvedValue([{ id: 1, name: 'Project A', status: 'active' }]);
      const response = await request(app).get('/api/projects?status=active');
      expectStatus(response, 200);
      expect(helpers.dbAll).toHaveBeenCalledWith(
        expect.stringContaining('AND p.status = ?'),
        ['test@example.com', 'active']
      );
    });

    test('should reject invalid clientId query param', async () => {
      expectError(await request(app).get('/api/projects?clientId=abc'), 400, 'Invalid client ID');
    });

    test('should reject invalid status query param', async () => {
      expectError(
        await request(app).get('/api/projects?status=invalid'),
        400, 'Invalid status. Must be one of: active, completed, on-hold'
      );
    });

    test('should handle database error on list', async () => {
      helpers.dbAll.mockRejectedValue(new Error('Database error'));
      expectError(await request(app).get('/api/projects'), 500, 'Internal server error');
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project', async () => {
      const mockProject = { id: 1, name: 'Project A', client_id: 1, status: 'active' };
      helpers.dbGet.mockResolvedValue(mockProject);
      const response = await request(app).get('/api/projects/1');
      expectStatus(response, 200);
      expect(response.body).toEqual({ project: mockProject });
    });

    test('should return 404 when project does not exist', async () => {
      helpers.dbGet.mockResolvedValue(null);
      expectError(await request(app).get('/api/projects/999'), 404, 'Project not found');
    });

    test('should reject non-numeric project ID', async () => {
      expectError(await request(app).get('/api/projects/invalid'), 400, 'Invalid project ID');
    });

    test('should handle database failure on get', async () => {
      helpers.dbGet.mockRejectedValue(new Error('Database error'));
      expectError(await request(app).get('/api/projects/1'), 500, 'Internal server error');
    });
  });

  describe('POST /api/projects', () => {
    const validPayload = { name: 'New Project', description: 'Description', clientId: 1, status: 'active' };

    test('should create new project with valid data', async () => {
      const createdProject = { id: 1, ...validPayload, client_name: 'Client A' };
      helpers.dbGet
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(createdProject);
      helpers.dbRun.mockResolvedValue({ lastID: 1 });

      const response = await request(app).post('/api/projects').send(validPayload);

      expectStatus(response, 201);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.project).toEqual(createdProject);
    });

    test('should create project with only required fields', async () => {
      const minPayload = { name: 'Minimal', clientId: 1 };
      const createdProject = { id: 1, name: 'Minimal', client_id: 1, status: 'active' };
      helpers.dbGet.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(createdProject);
      helpers.dbRun.mockResolvedValue({ lastID: 1 });

      const response = await request(app).post('/api/projects').send(minPayload);
      expectStatus(response, 201);
      expect(response.body.project).toEqual(createdProject);
    });

    test('should reject when referenced client does not exist', async () => {
      helpers.dbGet.mockResolvedValue(null);
      expectError(
        await request(app).post('/api/projects').send({ name: 'Project', clientId: 999 }),
        400, 'Client not found or does not belong to user'
      );
    });

    test('should reject payload missing required name', async () => {
      expectStatus(
        await request(app).post('/api/projects').send({ description: 'No name provided' }),
        400
      );
    });

    test('should reject payload with invalid status enum', async () => {
      expectStatus(
        await request(app).post('/api/projects').send({ name: 'Project', clientId: 1, status: 'invalid' }),
        400
      );
    });

    test('should handle database failure on client verification', async () => {
      helpers.dbGet.mockRejectedValue(new Error('Database error'));
      expectStatus(await request(app).post('/api/projects').send({ name: 'Project', clientId: 1 }), 500);
    });

    test('should handle database failure on insert', async () => {
      helpers.dbGet.mockResolvedValueOnce({ id: 1 });
      helpers.dbRun.mockRejectedValue(new Error('Database error'));
      expectError(
        await request(app).post('/api/projects').send({ name: 'Project', clientId: 1 }),
        500, 'Failed to create project'
      );
    });

    test('should handle failure to retrieve after successful insert', async () => {
      helpers.dbGet.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null);
      helpers.dbRun.mockResolvedValue({ lastID: 1 });
      expectError(
        await request(app).post('/api/projects').send({ name: 'Project', clientId: 1 }),
        500, 'Project created but failed to retrieve'
      );
    });
  });

  describe('PUT /api/projects/:id', () => {
    const updatePayload = { name: 'Updated', status: 'completed' };

    test('should update project fields', async () => {
      const updatedProject = { id: 1, name: 'Updated', client_id: 1, status: 'completed' };
      helpers.dbGet.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(updatedProject);
      helpers.dbRun.mockResolvedValue({ changes: 1 });
      helpers.buildUpdateQuery.mockReturnValue({
        query: 'UPDATE projects SET name = ? WHERE id = ? AND user_email = ?',
        values: ['Updated', 1, 'test@example.com']
      });

      const response = await request(app).put('/api/projects/1').send(updatePayload);

      expectStatus(response, 200);
      expect(response.body.message).toBe('Project updated successfully');
      expect(response.body.project).toEqual(updatedProject);
    });

    test('should return 404 for nonexistent project on update', async () => {
      helpers.dbGet.mockResolvedValue(null);
      expectError(
        await request(app).put('/api/projects/999').send({ name: 'Updated' }),
        404, 'Project not found'
      );
    });

    test('should reject non-numeric ID on update', async () => {
      expectError(
        await request(app).put('/api/projects/invalid').send({ name: 'Updated' }),
        400, 'Invalid project ID'
      );
    });

    test('should reject empty update body', async () => {
      expectStatus(await request(app).put('/api/projects/1').send({}), 400);
    });

    test('should verify new client exists when changing clientId', async () => {
      helpers.dbGet.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null);
      expectError(
        await request(app).put('/api/projects/1').send({ clientId: 999 }),
        400, 'Client not found or does not belong to user'
      );
    });

    test('should handle database failure checking project existence', async () => {
      helpers.dbGet.mockRejectedValue(new Error('Database error'));
      expectStatus(await request(app).put('/api/projects/1').send({ name: 'Updated' }), 500);
    });

    test('should handle database failure on update execution', async () => {
      helpers.dbGet.mockResolvedValueOnce({ id: 1 });
      helpers.buildUpdateQuery.mockReturnValue({ query: 'UPDATE...', values: [] });
      helpers.dbRun.mockRejectedValue(new Error('Database error'));
      expectError(
        await request(app).put('/api/projects/1').send({ name: 'Updated' }),
        500, 'Failed to update project'
      );
    });

    test('should handle failure to retrieve after successful update', async () => {
      helpers.dbGet.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null);
      helpers.buildUpdateQuery.mockReturnValue({ query: 'UPDATE...', values: [] });
      helpers.dbRun.mockResolvedValue({ changes: 1 });
      expectError(
        await request(app).put('/api/projects/1').send({ name: 'Updated' }),
        500, 'Project updated but failed to retrieve'
      );
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete existing project', async () => {
      helpers.dbGet.mockResolvedValue({ id: 1 });
      helpers.dbRun.mockResolvedValue({ changes: 1 });
      const response = await request(app).delete('/api/projects/1');
      expectStatus(response, 200);
      expect(response.body).toEqual({ message: 'Project deleted successfully' });
    });

    test('should return 404 for nonexistent project on delete', async () => {
      helpers.dbGet.mockResolvedValue(null);
      expectError(await request(app).delete('/api/projects/999'), 404, 'Project not found');
    });

    test('should reject non-numeric ID on delete', async () => {
      expectError(await request(app).delete('/api/projects/invalid'), 400, 'Invalid project ID');
    });

    test('should handle database failure verifying project for delete', async () => {
      helpers.dbGet.mockRejectedValue(new Error('Database error'));
      expectStatus(await request(app).delete('/api/projects/1'), 500);
    });

    test('should handle database failure executing delete', async () => {
      helpers.dbGet.mockResolvedValue({ id: 1 });
      helpers.dbRun.mockRejectedValue(new Error('Database error'));
      expectError(await request(app).delete('/api/projects/1'), 500, 'Failed to delete project');
    });
  });
});
