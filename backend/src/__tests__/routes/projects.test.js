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

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/projects', projectRoutes);
  app.use((err, req, res, next) => {
    if (err.isJoi) return res.status(400).json({ error: 'Validation error' });
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

function mockDbInsert(mockDb, lastID) {
  mockDb.run.mockImplementation(function(query, params, callback) {
    this.lastID = lastID;
    callback.call(this, null);
  });
}

function mockDbRunError(mockDb) {
  mockDb.run.mockImplementation(function(query, params, callback) {
    callback.call(this, new Error('Database error'));
  });
}

function mockDbGetResult(mockDb, result) {
  mockDb.get.mockImplementation((query, params, callback) => callback(null, result));
}

function mockDbGetError(mockDb) {
  mockDb.get.mockImplementation((query, params, callback) => callback(new Error('Database error'), null));
}

const app = createTestApp();

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
        { id: 1, name: 'Project A', description: 'Desc A', client_id: 1, start_date: '2024-01-01', status: 'active', client_name: 'Client A' },
        { id: 2, name: 'Project B', description: null, client_id: null, start_date: '2024-02-01', status: 'completed', client_name: null }
      ];
      mockDb.all.mockImplementation((query, params, callback) => callback(null, mockProjects));

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body.projects).toHaveLength(2);
      expect(response.body.projects[0].name).toBe('Project A');
    });

    test('should return empty array when no projects exist', async () => {
      mockDb.all.mockImplementation((query, params, callback) => callback(null, []));
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: [] });
    });

    test('should handle database error', async () => {
      mockDb.all.mockImplementation((query, params, callback) => callback(new Error('Database error'), null));
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project', async () => {
      const mockProject = { id: 1, name: 'Project A', status: 'active', client_name: 'Client A' };
      mockDbGetResult(mockDb, mockProject);

      const response = await request(app).get('/api/projects/1');
      expect(response.status).toBe(200);
      expect(response.body.project.name).toBe('Project A');
    });

    test('should return 404 if project not found', async () => {
      mockDbGetResult(mockDb, null);
      const response = await request(app).get('/api/projects/999');
      expect(response.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).get('/api/projects/invalid');
      expect(response.status).toBe(400);
    });

    test('should handle database error', async () => {
      mockDbGetError(mockDb);
      const response = await request(app).get('/api/projects/1');
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    test('should create new project with all fields including client_id', async () => {
      const newProject = { name: 'New Project', description: 'Desc', client_id: 1, start_date: '2024-03-01', status: 'active' };
      const created = { id: 1, ...newProject, client_name: 'Client A', created_at: '2024-01-01', updated_at: '2024-01-01' };

      // First get verifies client ownership, then run inserts, then get retrieves
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, created));
      mockDbInsert(mockDb, 1);

      const response = await request(app).post('/api/projects').send(newProject);
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.project.name).toBe('New Project');
    });

    test('should create project with only name (minimal, no client_id)', async () => {
      mockDbInsert(mockDb, 2);
      mockDbGetResult(mockDb, { id: 2, name: 'Minimal', description: null, client_id: null, start_date: null, status: 'active', client_name: null });

      const response = await request(app).post('/api/projects').send({ name: 'Minimal' });
      expect(response.status).toBe(201);
      expect(response.body.project.status).toBe('active');
    });

    test('should return 400 if client_id does not belong to user', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, null));

      const response = await request(app).post('/api/projects').send({ name: 'Test', client_id: 999 });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Client not found');
    });

    test('should return 400 for missing name', async () => {
      const response = await request(app).post('/api/projects').send({ description: 'No name' });
      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app).post('/api/projects').send({ name: 'Test', status: 'invalid' });
      expect(response.status).toBe(400);
    });

    test('should handle database error on insert', async () => {
      mockDbRunError(mockDb);
      const response = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create project');
    });

    test('should handle database error on retrieve after create', async () => {
      mockDbInsert(mockDb, 1);
      mockDbGetError(mockDb);
      const response = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Project created but failed to retrieve');
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project with valid data', async () => {
      const updatedProject = { id: 1, name: 'Updated', status: 'completed', client_name: 'Client A' };
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, updatedProject));
      mockDb.run.mockImplementation(function(query, params, callback) { callback.call(this, null); });

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated', status: 'completed' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project updated successfully');
      expect(response.body.project.name).toBe('Updated');
    });

    test('should return 404 if project not found', async () => {
      mockDbGetResult(mockDb, null);
      const response = await request(app).put('/api/projects/999').send({ name: 'Updated' });
      expect(response.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).put('/api/projects/invalid').send({ name: 'Updated' });
      expect(response.status).toBe(400);
    });

    test('should return 400 for empty update body', async () => {
      const response = await request(app).put('/api/projects/1').send({});
      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app).put('/api/projects/1').send({ status: 'invalid-status' });
      expect(response.status).toBe(400);
    });

    test('should handle database error on existence check', async () => {
      mockDbGetError(mockDb);
      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });
      expect(response.status).toBe(500);
    });

    test('should handle database error on update query', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }));
      mockDbRunError(mockDb);
      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update project');
    });

    test('should return 400 if updated client_id does not belong to user', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, null));

      const response = await request(app).put('/api/projects/1').send({ client_id: 999 });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Client not found');
    });

    test('should update project with valid client_id', async () => {
      const updatedProject = { id: 1, name: 'Proj', client_id: 2, client_name: 'Client B' };
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 2 }))
        .mockImplementationOnce((query, params, callback) => callback(null, updatedProject));
      mockDb.run.mockImplementation(function(query, params, callback) { callback.call(this, null); });

      const response = await request(app).put('/api/projects/1').send({ client_id: 2 });
      expect(response.status).toBe(200);
      expect(response.body.project.client_id).toBe(2);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project successfully', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation(function(query, params, callback) { callback.call(this, null); });

      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project deleted successfully');
    });

    test('should return 404 if project not found', async () => {
      mockDbGetResult(mockDb, null);
      const response = await request(app).delete('/api/projects/999');
      expect(response.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).delete('/api/projects/invalid');
      expect(response.status).toBe(400);
    });

    test('should handle database error on existence check', async () => {
      mockDbGetError(mockDb);
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(500);
    });

    test('should handle database error on delete', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDbRunError(mockDb);
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete project');
    });
  });
});
