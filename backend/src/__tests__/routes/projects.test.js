const request = require('supertest');
const express = require('express');
const projectRoutes = require('../../routes/projects');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => { req.userEmail = 'test@example.com'; next(); }
}));

const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);
app.use((err, req, res, next) => {
  if (err.isJoi) return res.status(400).json({ error: 'Validation error' });
  res.status(500).json({ error: 'Internal server error' });
});

// Helpers to reduce mock boilerplate
const mockDbError = (method) => (query, params, callback) => callback(new Error('DB error'), null);
const mockDbResult = (result) => (query, params, callback) => callback(null, result);
const mockRunSuccess = (lastID = 1) => function(query, params, callback) { this.lastID = lastID; callback.call(this, null); };

describe('Project Routes', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = { all: jest.fn(), get: jest.fn(), run: jest.fn() };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => jest.clearAllMocks());

  describe('GET /api/projects', () => {
    test('should return all projects for authenticated user', async () => {
      const mockProjects = [
        { id: 1, name: 'Project A', client_id: 1, status: 'active', client_name: 'Client A' },
        { id: 2, name: 'Project B', client_id: 2, status: 'completed', client_name: 'Client B' }
      ];
      mockDb.all.mockImplementation(mockDbResult(mockProjects));

      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: mockProjects });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT p.id, p.name'), ['test@example.com'], expect.any(Function)
      );
    });

    test('should return empty array when no projects exist', async () => {
      mockDb.all.mockImplementation(mockDbResult([]));
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: [] });
    });

    test('should filter projects by clientId', async () => {
      const filtered = [{ id: 1, name: 'Project A', client_id: 1, client_name: 'Client A' }];
      mockDb.all.mockImplementation(mockDbResult(filtered));

      const response = await request(app).get('/api/projects?clientId=1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: filtered });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND p.client_id = ?'), ['test@example.com', 1], expect.any(Function)
      );
    });

    test('should return 400 for invalid clientId filter', async () => {
      const response = await request(app).get('/api/projects?clientId=invalid');
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });

    test('should handle database error', async () => {
      mockDb.all.mockImplementation(mockDbError('all'));
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    const mockProject = { id: 1, name: 'Project A', client_id: 1, status: 'active', client_name: 'Client A' };

    test('should return specific project', async () => {
      mockDb.get.mockImplementation(mockDbResult(mockProject));
      const response = await request(app).get('/api/projects/1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ project: mockProject });
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation(mockDbResult(null));
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
      mockDb.get.mockImplementation(mockDbError('get'));
      const response = await request(app).get('/api/projects/1');
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    const createdProject = {
      id: 1, name: 'New Project', client_id: 1, status: 'active',
      description: null, start_date: null, end_date: null, budget_hours: null,
      client_name: 'Client A', created_at: '2024-01-01', updated_at: '2024-01-01'
    };

    function setupCreateMocks(project = createdProject) {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation(mockRunSuccess());
      mockDb.get.mockImplementationOnce(mockDbResult(project));
    }

    test('should create new project with valid data', async () => {
      setupCreateMocks();
      const response = await request(app).post('/api/projects').send({ name: 'New Project', clientId: 1, status: 'active' });
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.project).toEqual(createdProject);
    });

    test('should create project with all fields', async () => {
      const fullProject = { id: 1, name: 'Full Project', description: 'A full project', client_name: 'Client A' };
      setupCreateMocks(fullProject);
      const response = await request(app).post('/api/projects').send({
        name: 'Full Project', description: 'A full project', clientId: 1,
        startDate: '2024-01-01', endDate: '2024-12-31', status: 'active', budgetHours: 100
      });
      expect(response.status).toBe(201);
    });

    test('should return 400 for missing name', async () => {
      const response = await request(app).post('/api/projects').send({ clientId: 1 });
      expect(response.status).toBe(400);
    });

    test('should return 400 for missing clientId', async () => {
      const response = await request(app).post('/api/projects').send({ name: 'Project without client' });
      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app).post('/api/projects').send({ name: 'Test', clientId: 1, status: 'invalid-status' });
      expect(response.status).toBe(400);
    });

    test('should return 400 if client does not belong to user', async () => {
      mockDb.get.mockImplementation(mockDbResult(null));
      const response = await request(app).post('/api/projects').send({ name: 'Test', clientId: 999 });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('should handle database error checking client', async () => {
      mockDb.get.mockImplementation(mockDbError('get'));
      const response = await request(app).post('/api/projects').send({ name: 'Test', clientId: 1 });
      expect(response.status).toBe(500);
    });

    test('should handle database insert error', async () => {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('Insert failed')));
      const response = await request(app).post('/api/projects').send({ name: 'Test', clientId: 1 });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create project' });
    });

    test('should handle error retrieving project after creation', async () => {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation(mockRunSuccess());
      mockDb.get.mockImplementationOnce(mockDbError('get'));
      const response = await request(app).post('/api/projects').send({ name: 'Test', clientId: 1 });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project created but failed to retrieve' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    function setupUpdateMocks(result) {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));
      mockDb.get.mockImplementationOnce(mockDbResult(result));
    }

    test('should update project name', async () => {
      const updated = { id: 1, name: 'Updated Name', client_id: 1, status: 'active', client_name: 'Client A' };
      setupUpdateMocks(updated);
      const response = await request(app).put('/api/projects/1').send({ name: 'Updated Name' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project updated successfully');
      expect(response.body.project).toEqual(updated);
    });

    test('should update project status', async () => {
      setupUpdateMocks({ id: 1, name: 'Project', status: 'completed' });
      const response = await request(app).put('/api/projects/1').send({ status: 'completed' });
      expect(response.status).toBe(200);
    });

    test('should update project clientId and verify ownership', async () => {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));  // project exists
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 2 }));  // new client exists
      mockDb.run.mockImplementation((query, params, callback) => callback(null));
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1, name: 'Project', client_id: 2, client_name: 'Client B' }));

      const response = await request(app).put('/api/projects/1').send({ clientId: 2 });
      expect(response.status).toBe(200);
    });

    test('should return 400 when updating to invalid client', async () => {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.get.mockImplementationOnce(mockDbResult(null));
      const response = await request(app).put('/api/projects/1').send({ clientId: 999 });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation(mockDbResult(null));
      const response = await request(app).put('/api/projects/999').send({ name: 'Updated' });
      expect(response.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).put('/api/projects/invalid').send({ name: 'Updated' });
      expect(response.status).toBe(400);
    });

    test('should return 400 for empty update', async () => {
      const response = await request(app).put('/api/projects/1').send({});
      expect(response.status).toBe(400);
    });

    test('should handle database error when checking project existence', async () => {
      mockDb.get.mockImplementation(mockDbError('get'));
      const response = await request(app).put('/api/projects/1').send({ name: 'Updated Name' });
      expect(response.status).toBe(500);
    });

    test('should handle database error during update', async () => {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('Update failed')));
      const response = await request(app).put('/api/projects/1').send({ name: 'Updated Name' });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update project' });
    });

    test('should handle error retrieving project after update', async () => {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));
      mockDb.get.mockImplementationOnce(mockDbError('get'));
      const response = await request(app).put('/api/projects/1').send({ name: 'Updated Name' });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project updated but failed to retrieve' });
    });

    test('should handle database error when verifying new client ownership', async () => {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.get.mockImplementationOnce(mockDbError('get'));
      const response = await request(app).put('/api/projects/1').send({ clientId: 2 });
      expect(response.status).toBe(500);
    });

    test('should update multiple fields at once', async () => {
      const updated = { id: 1, name: 'New Name', description: 'New Desc', status: 'on-hold', budget_hours: 200, client_name: 'Client A' };
      setupUpdateMocks(updated);
      const response = await request(app).put('/api/projects/1')
        .send({ name: 'New Name', description: 'New Desc', status: 'on-hold', budgetHours: 200 });
      expect(response.status).toBe(200);
      expect(response.body.project).toEqual(updated);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete existing project', async () => {
      mockDb.get.mockImplementation(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Project deleted successfully' });
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation(mockDbResult(null));
      const response = await request(app).delete('/api/projects/999');
      expect(response.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).delete('/api/projects/invalid');
      expect(response.status).toBe(400);
    });

    test('should handle database delete error', async () => {
      mockDb.get.mockImplementation(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('Delete failed')));
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete project' });
    });

    test('should handle database error when checking project existence', async () => {
      mockDb.get.mockImplementation(mockDbError('get'));
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(500);
    });
  });
});
