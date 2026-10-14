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
      const createdProject = { id: 1, name: 'Client Project', client_id: 1, client_name: 'Client A', status: 'active', created_at: '2024-01-01', updated_at: '2024-01-01' };

      // First get call: verify client exists
      // Second get call: retrieve created project
      let getCallCount = 0;
      mockDb.get.mockImplementation((query, params, callback) => {
        getCallCount++;
        if (getCallCount === 1) {
          callback(null, { id: 1 }); // client exists
        } else {
          callback(null, createdProject);
        }
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
    });

    test('should return 400 for invalid client', async () => {
      const newProject = { name: 'Bad Client Project', clientId: 999 };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null); // client not found
      });

      const response = await request(app)
        .post('/api/projects')
        .send(newProject);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ description: 'No name project' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Validation error' });
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Bad Status', status: 'invalid-status' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Validation error' });
    });

    test('should create project without optional fields', async () => {
      const newProject = { name: 'Minimal Project' };
      const createdProject = { id: 1, name: 'Minimal Project', description: null, client_id: null, start_date: null, status: 'active', client_name: null, created_at: '2024-01-01', updated_at: '2024-01-01' };

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
      expect(response.body.project.description).toBeNull();
      expect(response.body.project.client_id).toBeNull();
      expect(response.body.project.status).toBe('active');
    });

    test('should handle database error on insert', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, new Error('Database error'));
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Error Project' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create project' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project with valid data', async () => {
      const updatedProject = { id: 1, name: 'Updated Project', description: 'Updated Desc', client_id: null, start_date: null, status: 'active', client_name: null };

      // First get: check project exists
      // Second get: return updated project
      let getCallCount = 0;
      mockDb.get.mockImplementation((query, params, callback) => {
        getCallCount++;
        if (getCallCount === 1) {
          callback(null, { id: 1 }); // project exists
        } else {
          callback(null, updatedProject);
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, null);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated Project', description: 'Updated Desc' });

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
        .send({ name: 'Nonexistent' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app)
        .put('/api/projects/invalid')
        .send({ name: 'Test' });

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

    test('should update project status', async () => {
      const updatedProject = { id: 1, name: 'Project A', status: 'completed' };

      let getCallCount = 0;
      mockDb.get.mockImplementation((query, params, callback) => {
        getCallCount++;
        if (getCallCount === 1) {
          callback(null, { id: 1 });
        } else {
          callback(null, updatedProject);
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, null);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.project.status).toBe('completed');
    });

    test('should validate client exists when updating clientId', async () => {
      // First get: project exists
      // Second get: client not found
      let getCallCount = 0;
      mockDb.get.mockImplementation((query, params, callback) => {
        getCallCount++;
        if (getCallCount === 1) {
          callback(null, { id: 1 }); // project exists
        } else {
          callback(null, null); // client not found
        }
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ clientId: 999 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('should handle database error on update', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 }); // project exists
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, new Error('Database error'));
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Error Update' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update project' });
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, null);
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

    test('should handle database error on existence check', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error on delete', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call(this, new Error('Database error'));
      });

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete project' });
    });
  });
});
