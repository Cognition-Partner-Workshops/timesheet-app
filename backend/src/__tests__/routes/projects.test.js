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

function mockDbError(method) {
  return (query, params, callback) => callback(new Error('Database error'), null);
}

function mockRunSuccess(lastID = 1) {
  return function(query, params, callback) {
    this.lastID = lastID;
    callback.call(this, null);
  };
}

function mockRunError() {
  return function(query, params, callback) {
    callback.call(this, new Error('Database error'));
  };
}

const sampleProject = {
  id: 1, name: 'Project A', description: 'Desc A', client_id: 1,
  client_name: 'Client A', start_date: '2024-01-01', status: 'active',
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
      const projects = [sampleProject, { ...sampleProject, id: 2, name: 'Project B', status: 'on-hold' }];
      mockDb.all.mockImplementation((q, p, cb) => cb(null, projects));

      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects });
    });

    test('should return empty array when no projects exist', async () => {
      mockDb.all.mockImplementation((q, p, cb) => cb(null, []));
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: [] });
    });

    test('should handle database error', async () => {
      mockDb.all.mockImplementation(mockDbError());
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, sampleProject));
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ project: sampleProject });
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, null));
      const res = await request(app).get('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const res = await request(app).get('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('should handle database error', async () => {
      mockDb.get.mockImplementation(mockDbError());
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    test('should create new project with valid data', async () => {
      mockDb.run.mockImplementation(mockRunSuccess());
      mockDb.get.mockImplementation((q, p, cb) => cb(null, sampleProject));

      const res = await request(app).post('/api/projects').send({ name: 'Project A', status: 'active' });
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
    });

    test('should create project with client assignment', async () => {
      mockDb.get
        .mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }))
        .mockImplementationOnce((q, p, cb) => cb(null, sampleProject));
      mockDb.run.mockImplementation(mockRunSuccess());

      const res = await request(app).post('/api/projects').send({ name: 'Client Project', client_id: 1 });
      expect(res.status).toBe(201);
    });

    test('should return 400 if client_id references non-existent client', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, null));
      const res = await request(app).post('/api/projects').send({ name: 'Bad', client_id: 999 });
      expect(res.status).toBe(400);
    });

    test('should return 400 for missing name', async () => {
      const res = await request(app).post('/api/projects').send({ description: 'No name' });
      expect(res.status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'T', status: 'invalid' });
      expect(res.status).toBe(400);
    });

    test('should handle database error on insert', async () => {
      mockDb.run.mockImplementation(mockRunError());
      const res = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project with valid data', async () => {
      const updated = { ...sampleProject, name: 'Updated', status: 'completed' };
      mockDb.get
        .mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }))
        .mockImplementationOnce((q, p, cb) => cb(null, updated));
      mockDb.run.mockImplementation(mockRunSuccess());

      const res = await request(app).put('/api/projects/1').send({ name: 'Updated', status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project updated successfully');
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, null));
      const res = await request(app).put('/api/projects/999').send({ name: 'X' });
      expect(res.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const res = await request(app).put('/api/projects/invalid').send({ name: 'X' });
      expect(res.status).toBe(400);
    });

    test('should return 400 for empty body', async () => {
      const res = await request(app).put('/api/projects/1').send({});
      expect(res.status).toBe(400);
    });

    test('should return 400 if updating with invalid client_id', async () => {
      mockDb.get
        .mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }))
        .mockImplementationOnce((q, p, cb) => cb(null, null));
      const res = await request(app).put('/api/projects/1').send({ client_id: 999 });
      expect(res.status).toBe(400);
    });

    test('should handle database error on update', async () => {
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation(mockRunError());
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation(mockRunSuccess());
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project deleted successfully');
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, null));
      const res = await request(app).delete('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const res = await request(app).delete('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('should handle database error on delete', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation(mockRunError());
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });
});
