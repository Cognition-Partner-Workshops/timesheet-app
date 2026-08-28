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
// Add error handler for Joi validation
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
        { id: 1, name: 'Project A', description: 'Desc A', client_id: 1, start_date: '2024-01-01', status: 'active', client_name: 'Client A', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, name: 'Project B', description: 'Desc B', client_id: null, start_date: null, status: 'completed', client_name: null, created_at: '2024-01-02', updated_at: '2024-01-02' }
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockProjects);
      });

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: mockProjects });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT p.id, p.name'),
        ['test@example.com'],
        expect.any(Function)
      );
    });

    test('should return empty array when no projects exist', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: [] });
    });

    test('should filter projects by clientId', async () => {
      const mockProjects = [
        { id: 1, name: 'Project A', client_id: 1, status: 'active', client_name: 'Client A' }
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockProjects);
      });

      const response = await request(app).get('/api/projects?clientId=1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: mockProjects });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND p.client_id = ?'),
        ['test@example.com', 1],
        expect.any(Function)
      );
    });

    test('should return 400 for invalid clientId filter', async () => {
      const response = await request(app).get('/api/projects?clientId=invalid');

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
      const mockProject = { id: 1, name: 'Project A', description: 'Desc A', client_id: 1, start_date: '2024-01-01', status: 'active', client_name: 'Client A' };

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
    test('should create new project with valid data', async () => {
      const newProject = { name: 'New Project', description: 'New Description', status: 'active' };
      const createdProject = { id: 1, ...newProject, client_id: null, start_date: null, client_name: null, created_at: '2024-01-01', updated_at: '2024-01-01' };

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, createdProject);
      });

      const response = await request(app)
        .post('/api/projects')
        .send(newProject);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.project).toEqual(createdProject);
    });

    test('should create project with client assignment', async () => {
      const newProject = { name: 'Client Project', clientId: 1 };
      const createdProject = { id: 1, name: 'Client Project', client_id: 1, client_name: 'Client A', status: 'active' };

      // First get: verify client belongs to user
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      // Second get: retrieve created project
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, createdProject);
      });

      const response = await request(app)
        .post('/api/projects')
        .send(newProject);

      expect(response.status).toBe(201);
      expect(response.body.project).toEqual(createdProject);
    });

    test('should create project with start date', async () => {
      const newProject = { name: 'Dated Project', startDate: '2024-06-01' };
      const createdProject = { id: 1, name: 'Dated Project', start_date: '2024-06-01', status: 'active' };

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, createdProject);
      });

      const response = await request(app)
        .post('/api/projects')
        .send(newProject);

      expect(response.status).toBe(201);
    });

    test('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ description: 'No name provided' });

      expect(response.status).toBe(400);
    });

    test('should return 400 for empty name', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: '' });

      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Test', status: 'invalid-status' });

      expect(response.status).toBe(400);
    });

    test('should return 400 when client does not belong to user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project', clientId: 999 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('should handle database insert error', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Insert failed'));
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create project' });
    });

    test('should handle error retrieving project after creation', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Retrieval failed'), null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project created but failed to retrieve' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project name', async () => {
      const updatedProject = { id: 1, name: 'Updated Name', status: 'active' };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 }); // Project exists
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, updatedProject);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project updated successfully');
      expect(response.body.project).toEqual(updatedProject);
    });

    test('should update project status', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1, name: 'Project', status: 'completed' });
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.project.status).toBe('completed');
    });

    test('should update project client assignment', async () => {
      // First get: project exists
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      // Second get: client belongs to user
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 2 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      // Third get: return updated project
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1, name: 'Project', client_id: 2, client_name: 'Client B' });
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ clientId: 2 });

      expect(response.status).toBe(200);
    });

    test('should return 400 when updating to non-existent client', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 }); // Project exists
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, null); // Client not found
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ clientId: 999 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
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

    test('should return 400 for empty update', async () => {
      const response = await request(app)
        .put('/api/projects/1')
        .send({});

      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid status value', async () => {
      const response = await request(app)
        .put('/api/projects/1')
        .send({ status: 'invalid' });

      expect(response.status).toBe(400);
    });

    test('should handle database error when checking project existence', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error during update', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Update failed'));
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update project' });
    });

    test('should handle error retrieving project after update', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(new Error('Retrieval failed'), null);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project updated but failed to retrieve' });
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete existing project', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Project deleted successfully' });
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

    test('should handle database delete error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Delete failed'));
      });

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete project' });
    });

    test('should handle database error when checking project existence', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });
});
