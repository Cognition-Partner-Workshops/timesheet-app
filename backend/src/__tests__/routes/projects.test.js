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

describe('Project Routes', () => {
  let mockDb;

  const mockDbError = (method) =>
    mockDb[method].mockImplementation((query, params, callback) => {
      callback(new Error('Database error'), null);
    });

  const mockDbGet = (result) =>
    mockDb.get.mockImplementation((query, params, callback) => callback(null, result));

  const mockDbRun = (err = null) =>
    mockDb.run.mockImplementation(function(query, params, callback) {
      this.lastID = 1;
      callback.call(this, err);
    });

  beforeEach(() => {
    mockDb = { all: jest.fn(), get: jest.fn(), run: jest.fn() };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => jest.clearAllMocks());

  describe('GET /api/projects', () => {
    test('should return all projects for authenticated user', async () => {
      const mockProjects = [
        { id: 1, name: 'Project A', status: 'active', client_name: 'Client A' },
        { id: 2, name: 'Project B', status: 'completed', client_name: null }
      ];
      mockDb.all.mockImplementation((q, p, cb) => cb(null, mockProjects));

      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: mockProjects });
    });

    test('should return empty array when no projects exist', async () => {
      mockDb.all.mockImplementation((q, p, cb) => cb(null, []));
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: [] });
    });

    test('should handle database error', async () => {
      mockDbError('all');
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project', async () => {
      const project = { id: 1, name: 'Project A', status: 'active' };
      mockDbGet(project);
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ project });
    });

    test('should return 404 if not found', async () => {
      mockDbGet(null);
      const res = await request(app).get('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('should return 400 for invalid ID', async () => {
      const res = await request(app).get('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('should handle database error', async () => {
      mockDbError('get');
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    test('should create project with valid data', async () => {
      const created = { id: 1, name: 'New Project', status: 'active', client_name: null };
      mockDbRun();
      mockDbGet(created);

      const res = await request(app).post('/api/projects').send({ name: 'New Project' });
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
      expect(res.body.project).toEqual(created);
    });

    test('should create project with client assignment', async () => {
      const created = { id: 1, name: 'Client Project', client_id: 1, client_name: 'Client A' };
      mockDb.get
        .mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }))   // client check
        .mockImplementationOnce((q, p, cb) => cb(null, created));      // fetch created
      mockDbRun();

      const res = await request(app).post('/api/projects')
        .send({ name: 'Client Project', clientId: 1, startDate: '2024-06-01' });
      expect(res.status).toBe(201);
    });

    test('should reject unknown client', async () => {
      mockDbGet(null);
      const res = await request(app).post('/api/projects').send({ name: 'P', clientId: 999 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Client not found/);
    });

    test('should reject missing name', async () => {
      const res = await request(app).post('/api/projects').send({ description: 'No name' });
      expect(res.status).toBe(400);
    });

    test('should reject invalid status', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'T', status: 'bad' });
      expect(res.status).toBe(400);
    });

    test('should handle insert error', async () => {
      mockDbRun(new Error('fail'));
      const res = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(res.status).toBe(500);
    });

    test('should handle client check error', async () => {
      mockDbError('get');
      const res = await request(app).post('/api/projects').send({ name: 'T', clientId: 1 });
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project', async () => {
      const updated = { id: 1, name: 'Updated', status: 'completed' };
      mockDb.get
        .mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }))  // ownership
        .mockImplementationOnce((q, p, cb) => cb(null, updated));     // fetch updated
      mockDbRun();

      const res = await request(app).put('/api/projects/1').send({ name: 'Updated', status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project updated successfully');
    });

    test('should return 404 if not found', async () => {
      mockDbGet(null);
      const res = await request(app).put('/api/projects/999').send({ name: 'X' });
      expect(res.status).toBe(404);
    });

    test('should return 400 for invalid ID', async () => {
      const res = await request(app).put('/api/projects/invalid').send({ name: 'X' });
      expect(res.status).toBe(400);
    });

    test('should reject empty body', async () => {
      const res = await request(app).put('/api/projects/1').send({});
      expect(res.status).toBe(400);
    });

    test('should reject invalid status', async () => {
      const res = await request(app).put('/api/projects/1').send({ status: 'bad' });
      expect(res.status).toBe(400);
    });

    test('should validate client ownership on clientId update', async () => {
      mockDb.get
        .mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }))  // project exists
        .mockImplementationOnce((q, p, cb) => cb(null, null));        // client not found
      const res = await request(app).put('/api/projects/1').send({ clientId: 999 });
      expect(res.status).toBe(400);
    });

    test('should handle ownership check error', async () => {
      mockDbError('get');
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
    });

    test('should handle update error', async () => {
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDbRun(new Error('fail'));
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project', async () => {
      mockDbGet({ id: 1 });
      mockDbRun();
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project deleted successfully');
    });

    test('should return 404 if not found', async () => {
      mockDbGet(null);
      const res = await request(app).delete('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('should return 400 for invalid ID', async () => {
      const res = await request(app).delete('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('should handle ownership check error', async () => {
      mockDbError('get');
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });

    test('should handle delete error', async () => {
      mockDbGet({ id: 1 });
      mockDbRun(new Error('fail'));
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });
});
