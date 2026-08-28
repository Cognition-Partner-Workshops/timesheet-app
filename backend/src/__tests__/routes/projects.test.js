const request = require('supertest');
const projectRoutes = require('../../routes/projects');
const { getDatabase } = require('../../database/init');
const { createTestApp, createMockDb, mockDbError, mockDbResult, mockRunSuccess } = require('../helpers/testSetup');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => { req.userEmail = 'test@example.com'; next(); }
}));

const app = createTestApp('/api/projects', projectRoutes);

describe('Project Routes', () => {
  let mockDb;
  beforeEach(() => { mockDb = createMockDb(getDatabase); });
  afterEach(() => jest.clearAllMocks());

  describe('GET /api/projects', () => {
    test('should return all projects for authenticated user', async () => {
      const mockProjects = [
        { id: 1, name: 'Project A', client_id: 1, status: 'active', client_name: 'Client A' },
        { id: 2, name: 'Project B', client_id: 2, status: 'completed', client_name: 'Client B' }
      ];
      mockDb.all.mockImplementation(mockDbResult(mockProjects));

      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: mockProjects });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT p.id, p.name'), ['test@example.com'], expect.any(Function)
      );
    });

    test('should return empty array when no projects exist', async () => {
      mockDb.all.mockImplementation(mockDbResult([]));
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: [] });
    });

    test('should filter projects by clientId', async () => {
      const filtered = [{ id: 1, name: 'Project A', client_id: 1, client_name: 'Client A' }];
      mockDb.all.mockImplementation(mockDbResult(filtered));

      const res = await request(app).get('/api/projects?clientId=1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: filtered });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND p.client_id = ?'), ['test@example.com', 1], expect.any(Function)
      );
    });

    test('should return 400 for invalid clientId filter', async () => {
      const res = await request(app).get('/api/projects?clientId=invalid');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid client ID' });
    });

    test('should handle database error', async () => {
      mockDb.all.mockImplementation(mockDbError());
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    const sampleProject = { id: 1, name: 'Project A', client_id: 1, status: 'active', client_name: 'Client A' };

    test('should return specific project', async () => {
      mockDb.get.mockImplementation(mockDbResult(sampleProject));
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ project: sampleProject });
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation(mockDbResult(null));
      const res = await request(app).get('/api/projects/999');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Project not found' });
    });

    test('should return 400 for invalid project ID', async () => {
      const res = await request(app).get('/api/projects/invalid');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid project ID' });
    });

    test('should handle database error', async () => {
      mockDb.get.mockImplementation(mockDbError());
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    const created = {
      id: 1, name: 'New Project', client_id: 1, status: 'active',
      description: null, start_date: null, end_date: null, budget_hours: null,
      client_name: 'Client A', created_at: '2024-01-01', updated_at: '2024-01-01'
    };

    function mockCreateFlow(project = created) {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation(mockRunSuccess());
      mockDb.get.mockImplementationOnce(mockDbResult(project));
    }

    test('should create new project with valid data', async () => {
      mockCreateFlow();
      const res = await request(app).post('/api/projects').send({ name: 'New Project', clientId: 1, status: 'active' });
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
      expect(res.body.project).toEqual(created);
    });

    test('should create project with all fields', async () => {
      mockCreateFlow({ id: 1, name: 'Full Project', description: 'A full project', client_name: 'Client A' });
      const res = await request(app).post('/api/projects').send({
        name: 'Full Project', description: 'A full project', clientId: 1,
        startDate: '2024-01-01', endDate: '2024-12-31', status: 'active', budgetHours: 100
      });
      expect(res.status).toBe(201);
    });

    test('should return 400 for missing name', async () => {
      expect((await request(app).post('/api/projects').send({ clientId: 1 })).status).toBe(400);
    });

    test('should return 400 for missing clientId', async () => {
      expect((await request(app).post('/api/projects').send({ name: 'No client' })).status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      expect((await request(app).post('/api/projects').send({ name: 'X', clientId: 1, status: 'bad' })).status).toBe(400);
    });

    test('should return 400 if client does not belong to user', async () => {
      mockDb.get.mockImplementation(mockDbResult(null));
      const res = await request(app).post('/api/projects').send({ name: 'Test', clientId: 999 });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('should handle database error checking client', async () => {
      mockDb.get.mockImplementation(mockDbError());
      const res = await request(app).post('/api/projects').send({ name: 'Test', clientId: 1 });
      expect(res.status).toBe(500);
    });

    test('should handle database insert error', async () => {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation((q, p, cb) => cb(new Error('Insert failed')));
      const res = await request(app).post('/api/projects').send({ name: 'Test', clientId: 1 });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to create project' });
    });

    test('should handle error retrieving project after creation', async () => {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation(mockRunSuccess());
      mockDb.get.mockImplementationOnce(mockDbError());
      const res = await request(app).post('/api/projects').send({ name: 'Test', clientId: 1 });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Project created but failed to retrieve' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    function mockUpdateFlow(result) {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation((q, p, cb) => cb(null));
      mockDb.get.mockImplementationOnce(mockDbResult(result));
    }

    test('should update project name', async () => {
      const updated = { id: 1, name: 'Updated Name', client_id: 1, status: 'active', client_name: 'Client A' };
      mockUpdateFlow(updated);
      const res = await request(app).put('/api/projects/1').send({ name: 'Updated Name' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project updated successfully');
      expect(res.body.project).toEqual(updated);
    });

    test('should update project status', async () => {
      mockUpdateFlow({ id: 1, name: 'Project', status: 'completed' });
      const res = await request(app).put('/api/projects/1').send({ status: 'completed' });
      expect(res.status).toBe(200);
    });

    test('should update project clientId and verify ownership', async () => {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 2 }));
      mockDb.run.mockImplementation((q, p, cb) => cb(null));
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1, client_id: 2, client_name: 'Client B' }));
      const res = await request(app).put('/api/projects/1').send({ clientId: 2 });
      expect(res.status).toBe(200);
    });

    test('should return 400 when updating to invalid client', async () => {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.get.mockImplementationOnce(mockDbResult(null));
      const res = await request(app).put('/api/projects/1').send({ clientId: 999 });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation(mockDbResult(null));
      expect((await request(app).put('/api/projects/999').send({ name: 'X' })).status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      expect((await request(app).put('/api/projects/invalid').send({ name: 'X' })).status).toBe(400);
    });

    test('should return 400 for empty update', async () => {
      expect((await request(app).put('/api/projects/1').send({})).status).toBe(400);
    });

    test('should handle database error when checking project existence', async () => {
      mockDb.get.mockImplementation(mockDbError());
      expect((await request(app).put('/api/projects/1').send({ name: 'X' })).status).toBe(500);
    });

    test('should handle database error during update', async () => {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation((q, p, cb) => cb(new Error('Update failed')));
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to update project' });
    });

    test('should handle error retrieving project after update', async () => {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation((q, p, cb) => cb(null));
      mockDb.get.mockImplementationOnce(mockDbError());
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Project updated but failed to retrieve' });
    });

    test('should handle database error when verifying new client ownership', async () => {
      mockDb.get.mockImplementationOnce(mockDbResult({ id: 1 }));
      mockDb.get.mockImplementationOnce(mockDbError());
      expect((await request(app).put('/api/projects/1').send({ clientId: 2 })).status).toBe(500);
    });

    test('should update multiple fields at once', async () => {
      const updated = { id: 1, name: 'New', description: 'Desc', status: 'on-hold', budget_hours: 200, client_name: 'Client A' };
      mockUpdateFlow(updated);
      const res = await request(app).put('/api/projects/1')
        .send({ name: 'New', description: 'Desc', status: 'on-hold', budgetHours: 200 });
      expect(res.status).toBe(200);
      expect(res.body.project).toEqual(updated);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete existing project', async () => {
      mockDb.get.mockImplementation(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation((q, p, cb) => cb(null));
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Project deleted successfully' });
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation(mockDbResult(null));
      expect((await request(app).delete('/api/projects/999')).status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      expect((await request(app).delete('/api/projects/invalid')).status).toBe(400);
    });

    test('should handle database delete error', async () => {
      mockDb.get.mockImplementation(mockDbResult({ id: 1 }));
      mockDb.run.mockImplementation((q, p, cb) => cb(new Error('Delete failed')));
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to delete project' });
    });

    test('should handle database error when checking project existence', async () => {
      mockDb.get.mockImplementation(mockDbError());
      expect((await request(app).delete('/api/projects/1')).status).toBe(500);
    });
  });
});
