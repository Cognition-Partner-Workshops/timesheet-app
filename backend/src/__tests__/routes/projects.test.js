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
  if (err.isJoi) return res.status(400).json({ error: 'Validation error' });
  res.status(500).json({ error: 'Internal server error' });
});

function createMockDb() {
  return { all: jest.fn(), get: jest.fn(), run: jest.fn() };
}

function mockDbCallback(mockFn, err, result) {
  mockFn.mockImplementation((query, params, callback) => callback(err, result));
}

function mockDbRun(mockFn, err, context = {}) {
  mockFn.mockImplementation(function(query, params, callback) {
    Object.assign(this, context);
    callback.call(this, err);
  });
}

const SAMPLE_PROJECT = {
  id: 1, name: 'Project A', description: 'Desc A', client_id: 1,
  start_date: '2024-01-01', status: 'active', client_name: 'Client A',
  created_at: '2024-01-01', updated_at: '2024-01-01'
};

describe('Project Routes', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => jest.clearAllMocks());

  describe('GET /api/projects', () => {
    test('should return all projects for authenticated user', async () => {
      const projects = [SAMPLE_PROJECT, { ...SAMPLE_PROJECT, id: 2, name: 'Project B', status: 'on-hold', client_name: null }];
      mockDbCallback(mockDb.all, null, projects);

      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects });
      expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('SELECT p.id, p.name'), ['test@example.com'], expect.any(Function));
    });

    test('should return empty array when no projects exist', async () => {
      mockDbCallback(mockDb.all, null, []);
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: [] });
    });

    test('should handle database error', async () => {
      mockDbCallback(mockDb.all, new Error('Database error'), null);
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project', async () => {
      mockDbCallback(mockDb.get, null, SAMPLE_PROJECT);
      const response = await request(app).get('/api/projects/1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ project: SAMPLE_PROJECT });
    });

    test('should return 404 if project not found', async () => {
      mockDbCallback(mockDb.get, null, null);
      const response = await request(app).get('/api/projects/999');
      expect(response.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).get('/api/projects/invalid');
      expect(response.status).toBe(400);
    });

    test('should handle database error', async () => {
      mockDbCallback(mockDb.get, new Error('Database error'), null);
      const response = await request(app).get('/api/projects/1');
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    test('should create new project with valid data', async () => {
      mockDbRun(mockDb.run, null, { lastID: 1 });
      mockDbCallback(mockDb.get, null, SAMPLE_PROJECT);

      const response = await request(app).post('/api/projects')
        .send({ name: 'New Project', description: 'Desc', clientId: 1, startDate: '2024-01-15', status: 'active' });
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.project).toEqual(SAMPLE_PROJECT);
    });

    test('should create project with only name (defaults applied)', async () => {
      const minimal = { ...SAMPLE_PROJECT, description: null, client_id: null, start_date: null, client_name: null };
      mockDbRun(mockDb.run, null, { lastID: 1 });
      mockDbCallback(mockDb.get, null, minimal);

      const response = await request(app).post('/api/projects').send({ name: 'Minimal Project' });
      expect(response.status).toBe(201);
    });

    test('should return 400 for missing name', async () => {
      const response = await request(app).post('/api/projects').send({ description: 'No name' });
      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app).post('/api/projects').send({ name: 'Test', status: 'invalid-status' });
      expect(response.status).toBe(400);
    });

    test('should handle database error on insert', async () => {
      mockDbRun(mockDb.run, new Error('Database error'));
      const response = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(response.status).toBe(500);
    });

    test('should handle database error on retrieve after create', async () => {
      mockDbRun(mockDb.run, null, { lastID: 1 });
      mockDbCallback(mockDb.get, new Error('Database error'), null);
      const response = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project with valid data', async () => {
      const updated = { ...SAMPLE_PROJECT, name: 'Updated', status: 'completed' };
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDbRun(mockDb.run, null);
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, updated));

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated', status: 'completed' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project updated successfully');
    });

    test('should return 404 if project not found', async () => {
      mockDbCallback(mockDb.get, null, null);
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

    test('should return 400 for invalid status value', async () => {
      const response = await request(app).put('/api/projects/1').send({ status: 'invalid' });
      expect(response.status).toBe(400);
    });

    test('should handle database error on existence check', async () => {
      mockDbCallback(mockDb.get, new Error('Database error'), null);
      const response = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(response.status).toBe(500);
    });

    test('should handle database error on update', async () => {
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDbRun(mockDb.run, new Error('Database error'));
      const response = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(response.status).toBe(500);
    });

    test('should handle database error on retrieve after update', async () => {
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDbRun(mockDb.run, null);
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(new Error('Database error'), null));
      const response = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, { id: 1 }));
      mockDbRun(mockDb.run, null);
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Project deleted successfully' });
    });

    test('should return 404 if project not found', async () => {
      mockDbCallback(mockDb.get, null, null);
      const response = await request(app).delete('/api/projects/999');
      expect(response.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).delete('/api/projects/invalid');
      expect(response.status).toBe(400);
    });

    test('should handle database error on existence check', async () => {
      mockDbCallback(mockDb.get, new Error('Database error'), null);
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(500);
    });

    test('should handle database error on delete', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, { id: 1 }));
      mockDbRun(mockDb.run, new Error('Database error'));
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(500);
    });
  });
});
