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
        { id: 1, name: 'Project A', status: 'active', client_name: 'Client A' },
        { id: 2, name: 'Project B', status: 'completed', client_name: null }
      ];
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockProjects);
      });

      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: mockProjects });
    });

    test('should return empty array when no projects exist', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: [] });
    });

    test('should handle database error on list', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return a single project by id', async () => {
      const project = { id: 1, name: 'Project A', status: 'active' };
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, project);
      });

      const response = await request(app).get('/api/projects/1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ project });
    });

    test('should return 404 when project does not exist', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });
      const response = await request(app).get('/api/projects/999');
      expect(response.status).toBe(404);
    });

    test('should return 400 for non-numeric id', async () => {
      const response = await request(app).get('/api/projects/abc');
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Invalid project ID/);
    });

    test('should handle database error on get', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('fail'), null);
      });
      const response = await request(app).get('/api/projects/1');
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    test('should create a project with all fields', async () => {
      const created = { id: 1, name: 'New', status: 'active', client_name: 'C' };
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, created);
      });

      const response = await request(app).post('/api/projects').send({
        name: 'New', description: 'desc', clientId: 1,
        startDate: '2024-06-01', status: 'active'
      });
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.project).toEqual(created);
    });

    test('should create a project with only a name', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 2;
        callback.call(this, null);
      });
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 2, name: 'Min', status: 'active' });
      });

      const response = await request(app).post('/api/projects').send({ name: 'Min' });
      expect(response.status).toBe(201);
    });

    test('should reject missing name', async () => {
      const response = await request(app).post('/api/projects').send({ description: 'x' });
      expect(response.status).toBe(400);
    });

    test('should reject empty name', async () => {
      const response = await request(app).post('/api/projects').send({ name: '' });
      expect(response.status).toBe(400);
    });

    test('should reject invalid status value', async () => {
      const response = await request(app).post('/api/projects').send({ name: 'X', status: 'bad' });
      expect(response.status).toBe(400);
    });

    test('should handle insert failure', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('insert failed'));
      });
      const response = await request(app).post('/api/projects').send({ name: 'Y' });
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create project');
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project name', async () => {
      const updated = { id: 1, name: 'Updated', status: 'active' };
      mockDb.get
        .mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }))
        .mockImplementationOnce((q, p, cb) => cb(null, updated));
      mockDb.run.mockImplementation((q, p, cb) => cb(null));

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });
      expect(response.status).toBe(200);
      expect(response.body.project).toEqual(updated);
    });

    test('should update project status to on-hold', async () => {
      mockDb.get
        .mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }))
        .mockImplementationOnce((q, p, cb) => cb(null, { id: 1, status: 'on-hold' }));
      mockDb.run.mockImplementation((q, p, cb) => cb(null));

      const response = await request(app).put('/api/projects/1').send({ status: 'on-hold' });
      expect(response.status).toBe(200);
    });

    test('should return 404 for non-existent project', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, null));
      const response = await request(app).put('/api/projects/99').send({ name: 'X' });
      expect(response.status).toBe(404);
    });

    test('should return 400 for non-numeric id', async () => {
      const response = await request(app).put('/api/projects/abc').send({ name: 'X' });
      expect(response.status).toBe(400);
    });

    test('should return 400 for empty body', async () => {
      const response = await request(app).put('/api/projects/1').send({});
      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app).put('/api/projects/1').send({ status: 'nope' });
      expect(response.status).toBe(400);
    });

    test('should handle existence-check db error', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(new Error('fail'), null));
      const response = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(response.status).toBe(500);
    });

    test('should handle update db error', async () => {
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation((q, p, cb) => cb(new Error('update fail')));
      const response = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete an existing project', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation((q, p, cb) => cb(null));

      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project deleted successfully');
    });

    test('should return 404 for non-existent project', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, null));
      const response = await request(app).delete('/api/projects/99');
      expect(response.status).toBe(404);
    });

    test('should return 400 for non-numeric id', async () => {
      const response = await request(app).delete('/api/projects/abc');
      expect(response.status).toBe(400);
    });

    test('should handle delete db error', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation((q, p, cb) => cb(new Error('fail')));
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(500);
    });

    test('should handle existence-check db error on delete', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(new Error('fail'), null));
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/projects (bulk)', () => {
    test('should delete all projects for user', async () => {
      mockDb.run.mockImplementation(function(q, p, cb) {
        this.changes = 5;
        cb.call(this, null);
      });
      const response = await request(app).delete('/api/projects');
      expect(response.status).toBe(200);
      expect(response.body.deletedCount).toBe(5);
    });

    test('should handle bulk-delete db error', async () => {
      mockDb.run.mockImplementation((q, p, cb) => cb(new Error('fail')));
      const response = await request(app).delete('/api/projects');
      expect(response.status).toBe(500);
    });
  });
});
