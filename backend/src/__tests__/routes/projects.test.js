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

  beforeEach(() => {
    mockDb = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/projects', () => {
    test('should return all projects for authenticated user', async () => {
      const mockProjects = [
        { id: 1, name: 'Project A', client_id: 1, client_name: 'Client A', status: 'active' },
        { id: 2, name: 'Project B', client_id: 2, client_name: 'Client B', status: 'completed' }
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockProjects);
      });

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
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/projects?status=active');

      expect(response.status).toBe(200);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('p.status = ?'),
        ['test@example.com', 'active'],
        expect.any(Function)
      );
    });

    test('should filter by clientId', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

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
      expect(response.body).toEqual({ error: 'Invalid status filter. Must be: active, completed, or on-hold' });
    });

    test('should return 400 for invalid clientId filter', async () => {
      const response = await request(app).get('/api/projects?clientId=abc');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });

    test('should handle database error', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project', async () => {
      const mockProject = { id: 1, name: 'Project A', client_id: 1, status: 'active' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockProject);
      });

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ project: mockProject });
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

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
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/projects', () => {
    test('should create project with valid data', async () => {
      const newProject = { name: 'New Project', clientId: 1, status: 'active' };
      const createdProject = { id: 1, name: 'New Project', client_id: 1, status: 'active', client_name: 'Client A' };

      // First call: verify client exists
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      // Second call: return created project
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, createdProject);
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send(newProject);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.project).toEqual(createdProject);
    });

    test('should return 400 when client not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

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
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, new Error('Insert error'));
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Project', clientId: 1 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create project' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project with valid data', async () => {
      const updatedProject = { id: 1, name: 'Updated Project', client_id: 1, status: 'completed', client_name: 'Client A' };

      // First call: check project exists
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      // Second call: return updated project
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, updatedProject);
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, null);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated Project', status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project updated successfully');
      expect(response.body.project).toEqual(updatedProject);
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

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
    });

    test('should validate client when updating clientId', async () => {
      // Project exists
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      // Client not found
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ clientId: 999 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project and unlink work entries', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      // First run: update work_entries to nullify project_id
      mockDb.run.mockImplementationOnce((query, params, callback) => {
        callback(null);
      });

      // Second run: delete project
      mockDb.run.mockImplementationOnce(function(query, params, callback) {
        callback.call(this, null);
      });

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Project deleted successfully' });
      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).delete('/api/projects/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).delete('/api/projects/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
    });

    test('should handle database error on delete', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      // Unlink succeeds
      mockDb.run.mockImplementationOnce((query, params, callback) => {
        callback(null);
      });

      // Delete fails
      mockDb.run.mockImplementationOnce(function(query, params, callback) {
        callback.call(this, new Error('Delete error'));
      });

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete project' });
    });
  });
});
