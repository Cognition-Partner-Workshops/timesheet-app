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
        expect.stringContaining('SELECT p.id, p.name, p.description'),
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
      const newProject = { name: 'New Project', description: 'New Description', client_id: 1, start_date: '2024-06-01', status: 'active' };
      const createdProject = { id: 1, ...newProject, end_date: null, client_name: 'Client A', created_at: '2024-01-01', updated_at: '2024-01-01' };

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        // No overlap found (first call), then return created project (second call)
        callback(null, query.includes('SELECT p.id') ? createdProject : null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send(newProject);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.project).toEqual(createdProject);
    });

    test('should create project with only name (minimal data)', async () => {
      const newProject = { name: 'Minimal Project' };
      const createdProject = { id: 1, name: 'Minimal Project', description: null, client_id: null, start_date: null, end_date: null, status: 'active' };

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, query.includes('SELECT p.id') ? createdProject : null);
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

    test('should handle database insert error', async () => {
      // No overlap (first get returns null), then insert fails
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

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
      // No dates means overlap check is skipped, so the only db.get call is the retrieval
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Retrieval failed'), null);
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project created but failed to retrieve' });
    });

    test('should return 400 when end_date is before start_date', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Test', start_date: '2024-06-01', end_date: '2024-05-01' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'End date must not be before start date' });
    });

    test('should return 409 when project dates overlap with existing project', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        // Return overlapping project
        callback(null, { id: 5, name: 'Existing Project' });
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Overlap Test', start_date: '2024-03-01', end_date: '2024-06-01' });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('overlap');
      expect(response.body.error).toContain('Existing Project');
    });

    test('should allow creating project when dates do not overlap', async () => {
      const createdProject = { id: 2, name: 'Non-overlap', start_date: '2024-07-01', end_date: '2024-08-01', status: 'active' };

      let getCallCount = 0;
      mockDb.get.mockImplementation((query, params, callback) => {
        getCallCount++;
        if (getCallCount === 1) {
          callback(null, null); // No overlap found
        } else {
          callback(null, createdProject);
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 2;
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Non-overlap', start_date: '2024-07-01', end_date: '2024-08-01' });

      expect(response.status).toBe(201);
    });

    test('should skip overlap check when only start_date is provided (no end_date)', async () => {
      const createdProject = { id: 1, name: 'Start Only', start_date: '2024-01-01', end_date: null, status: 'active' };

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, query.includes('SELECT p.id') ? createdProject : null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Start Only', start_date: '2024-01-01' });

      expect(response.status).toBe(201);
    });

    test('should handle database error during overlap check', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('DB error'), null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Test', start_date: '2024-01-01', end_date: '2024-06-01' });

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project name', async () => {
      const updatedProject = { id: 1, name: 'Updated Name', description: 'Old Desc', status: 'active' };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1, start_date: null, end_date: null }); // Project exists
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
        callback(null, { id: 1, start_date: null, end_date: null });
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
    });

    test('should update multiple fields', async () => {
      const updatedProject = { id: 1, name: 'New Name', description: 'New Desc', status: 'on-hold', client_id: 2 };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1, start_date: null, end_date: null });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, updatedProject);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'New Name', description: 'New Desc', status: 'on-hold', client_id: 2 });

      expect(response.status).toBe(200);
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
        callback(null, { id: 1, start_date: null, end_date: null });
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
        callback(null, { id: 1, start_date: null, end_date: null });
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

    test('should return 400 when updating end_date before start_date', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1, start_date: '2024-06-01', end_date: '2024-12-01' });
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ end_date: '2024-01-01' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'End date must not be before start date' });
    });

    test('should return 409 when updating dates to overlap with another project', async () => {
      // First call: return existing project
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1, start_date: '2024-01-01', end_date: '2024-03-01' });
      });

      // Second call: overlap check returns an overlapping project
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 2, name: 'Other Project' });
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ start_date: '2024-02-01', end_date: '2024-05-01' });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('overlap');
      expect(response.body.error).toContain('Other Project');
    });

    test('should allow updating dates when no overlap exists', async () => {
      const updatedProject = { id: 1, name: 'Project', start_date: '2024-07-01', end_date: '2024-09-01', status: 'active' };

      // First call: return existing project
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1, start_date: '2024-01-01', end_date: '2024-03-01' });
      });

      // Second call: no overlap
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, null);
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      // Third call: return updated project
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, updatedProject);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ start_date: '2024-07-01', end_date: '2024-09-01' });

      expect(response.status).toBe(200);
      expect(response.body.project).toEqual(updatedProject);
    });

    test('should skip overlap check when end_date is cleared', async () => {
      const updatedProject = { id: 1, name: 'Project', start_date: '2024-01-01', end_date: null, status: 'active' };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1, start_date: '2024-01-01', end_date: '2024-06-01' });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, updatedProject);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ end_date: '' });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/projects', () => {
    test('should delete all projects for authenticated user', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.changes = 3;
        callback.call(this, null);
      });

      const response = await request(app).delete('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'All projects deleted successfully', deletedCount: 3 });
    });

    test('should handle database error when deleting all', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Delete failed'));
      });

      const response = await request(app).delete('/api/projects');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete projects' });
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
