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

const mockProject = {
  id: 1,
  name: 'Website Redesign',
  description: 'Redesign the marketing site',
  client_id: 2,
  start_date: '2024-01-01',
  status: 'active',
  client_name: 'Client A',
  created_at: '2024-01-01',
  updated_at: '2024-01-01'
};

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
      mockDb.all.mockImplementation((query, params, callback) => callback(null, [mockProject]));

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: [mockProject] });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('FROM projects p'),
        ['test@example.com'],
        expect.any(Function)
      );
    });

    test('should filter projects by status', async () => {
      mockDb.all.mockImplementation((query, params, callback) => callback(null, []));

      const response = await request(app).get('/api/projects?status=completed');

      expect(response.status).toBe(200);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('p.status = ?'),
        ['test@example.com', 'completed'],
        expect.any(Function)
      );
    });

    test('should handle database error', async () => {
      mockDb.all.mockImplementation((query, params, callback) => callback(new Error('Database error'), null));

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, mockProject));

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ project: mockProject });
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));

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
      mockDb.get.mockImplementation((query, params, callback) => callback(new Error('Database error'), null));

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/projects', () => {
    test('should create a project with a client assignment', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 2 }))
        .mockImplementationOnce((query, params, callback) => callback(null, mockProject));
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({
          name: 'Website Redesign',
          description: 'Redesign the marketing site',
          clientId: 2,
          startDate: '2024-01-01',
          status: 'active'
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: 'Project created successfully',
        project: mockProject
      });
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        ['Website Redesign', 'Redesign the marketing site', 2, '2024-01-01', 'active', 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should default status to active when omitted', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, mockProject));
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app).post('/api/projects').send({ name: 'Internal Tooling' });

      expect(response.status).toBe(201);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        ['Internal Tooling', null, null, null, 'active', 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should return 404 when the assigned client does not belong to the user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));

      const response = await request(app).post('/api/projects').send({ name: 'Project', clientId: 99 });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should return 400 when name is missing', async () => {
      const response = await request(app).post('/api/projects').send({ description: 'No name' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Validation error' });
    });

    test('should return 400 for an invalid status', async () => {
      const response = await request(app).post('/api/projects').send({ name: 'Project', status: 'archived' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Validation error' });
    });

    test('should handle database error on insert', async () => {
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('Database error')));

      const response = await request(app).post('/api/projects').send({ name: 'Project' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create project' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update a project', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, { ...mockProject, status: 'completed' }));
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app).put('/api/projects/1').send({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.project.status).toBe('completed');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE projects SET status = ?'),
        ['completed', 1, 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should validate the client when reassigning', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, null));

      const response = await request(app).put('/api/projects/1').send({ clientId: 99 });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));

      const response = await request(app).put('/api/projects/999').send({ name: 'New name' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).put('/api/projects/invalid').send({ name: 'New name' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
    });

    test('should return 400 when no fields are provided', async () => {
      const response = await request(app).put('/api/projects/1').send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Validation error' });
    });

    test('should handle database error on update', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('Database error')));

      const response = await request(app).put('/api/projects/1').send({ name: 'New name' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update project' });
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete a project', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Project deleted successfully' });
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));

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
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('Database error')));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete project' });
    });
  });
});
