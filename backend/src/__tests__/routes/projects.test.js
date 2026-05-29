const request = require('supertest');
const projectRoutes = require('../../routes/projects');
const { getDatabase } = require('../../database/init');
const { createTestApp, createMockDb } = require('../helpers/testApp');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const app = createTestApp('/api/projects', projectRoutes);

describe('Project Routes', () => {
  let mockDb;

  beforeEach(() => { mockDb = createMockDb(getDatabase); });
  afterEach(() => { jest.clearAllMocks(); });

  describe('GET /api/projects', () => {
    test('should return all projects for authenticated user', async () => {
      const mockProjects = [
        { id: 1, name: 'Project A', client_id: 1, client_name: 'Client A', status: 'active' },
        { id: 2, name: 'Project B', client_id: 2, client_name: 'Client B', status: 'completed' }
      ];
      mockDb.all.mockImplementation((query, params, callback) => callback(null, mockProjects));

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: mockProjects });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT p.id'),
        ['test@example.com'],
        expect.any(Function)
      );
    });

    test('should filter by status', async () => {
      mockDb.all.mockImplementation((query, params, callback) => callback(null, []));
      const response = await request(app).get('/api/projects?status=active');
      expect(response.status).toBe(200);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('p.status = ?'),
        ['test@example.com', 'active'],
        expect.any(Function)
      );
    });

    test('should filter by clientId', async () => {
      mockDb.all.mockImplementation((query, params, callback) => callback(null, []));
      const response = await request(app).get('/api/projects?clientId=1');
      expect(response.status).toBe(200);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('p.client_id = ?'),
        ['test@example.com', 1],
        expect.any(Function)
      );
    });

    test('should return 400 for invalid status filter', async () => {
      const response = await request(app).get('/api/projects?status=invalid');
      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid clientId filter', async () => {
      const response = await request(app).get('/api/projects?clientId=abc');
      expect(response.status).toBe(400);
    });

    test('should handle database error', async () => {
      mockDb.all.mockImplementation((query, params, callback) => callback(new Error('DB error'), null));
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project', async () => {
      const mockProject = { id: 1, name: 'Project A', client_id: 1, status: 'active' };
      mockDb.get.mockImplementation((query, params, callback) => callback(null, mockProject));

      const response = await request(app).get('/api/projects/1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ project: mockProject });
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));
      const response = await request(app).get('/api/projects/999');
      expect(response.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).get('/api/projects/invalid');
      expect(response.status).toBe(400);
    });

    test('should handle database error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(new Error('DB error'), null));
      const response = await request(app).get('/api/projects/1');
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    test('should create project with valid data', async () => {
      const createdProject = { id: 1, name: 'New Project', client_id: 1, status: 'active', client_name: 'Client A' };
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }));
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, createdProject));
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'New Project', clientId: 1, status: 'active' });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.project).toEqual(createdProject);
    });

    test('should return 400 when client not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));
      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Project', clientId: 999 });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ description: 'No name or clientId' });
      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Project', clientId: 1, status: 'invalid-status' });
      expect(response.status).toBe(400);
    });

    test('should handle database error on insert', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, new Error('Insert error'));
      });
      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Project', clientId: 1 });
      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project with valid data', async () => {
      const updatedProject = { id: 1, name: 'Updated', client_id: 1, status: 'completed', client_name: 'Client A' };
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }));
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, updatedProject));
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, null);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated', status: 'completed' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project updated successfully');
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));
      const response = await request(app).put('/api/projects/999').send({ name: 'X' });
      expect(response.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).put('/api/projects/invalid').send({ name: 'X' });
      expect(response.status).toBe(400);
    });

    test('should return 400 for empty body', async () => {
      const response = await request(app).put('/api/projects/1').send({});
      expect(response.status).toBe(400);
    });

    test('should validate client when updating clientId', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }));
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, null));
      const response = await request(app).put('/api/projects/1').send({ clientId: 999 });
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project and unlink work entries', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementationOnce((query, params, callback) => callback(null));
      mockDb.run.mockImplementationOnce(function(query, params, callback) { callback.call(this, null); });

      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Project deleted successfully' });
      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));
      const response = await request(app).delete('/api/projects/999');
      expect(response.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).delete('/api/projects/invalid');
      expect(response.status).toBe(400);
    });

    test('should handle database error on delete', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementationOnce((query, params, callback) => callback(null));
      mockDb.run.mockImplementationOnce(function(query, params, callback) {
        callback.call(this, new Error('Delete error'));
      });
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(500);
    });
  });
});
