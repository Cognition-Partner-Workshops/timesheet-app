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

function makeMockDb() {
  return { all: jest.fn(), get: jest.fn(), run: jest.fn() };
}

function dbErrorCallback(fn) {
  return fn.mockImplementation((q, p, cb) => cb(new Error('DB error'), null));
}

function dbSuccessAll(fn, data) {
  return fn.mockImplementation((q, p, cb) => cb(null, data));
}

function dbSuccessGet(fn, data) {
  return fn.mockImplementation((q, p, cb) => cb(null, data));
}

function dbSuccessGetOnce(fn, data) {
  return fn.mockImplementationOnce((q, p, cb) => cb(null, data));
}

function dbSuccessRun(fn, lastID) {
  return fn.mockImplementation(function(q, p, cb) {
    this.lastID = lastID;
    cb.call(this, null);
  });
}

const sampleProject = {
  id: 1, name: 'Project A', description: 'Desc A',
  client_id: 1, start_date: '2024-01-01', status: 'active',
  client_name: 'Client A', created_at: '2024-01-01', updated_at: '2024-01-01'
};

describe('Project Routes', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = makeMockDb();
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => jest.clearAllMocks());

  describe('GET /api/projects', () => {
    test('returns all projects for authenticated user', async () => {
      const projects = [sampleProject, { ...sampleProject, id: 2, name: 'Project B', status: 'on-hold', client_name: null }];
      dbSuccessAll(mockDb.all, projects);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects });
    });

    test('returns empty array when no projects exist', async () => {
      dbSuccessAll(mockDb.all, []);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: [] });
    });

    test('handles database error', async () => {
      dbErrorCallback(mockDb.all);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('returns specific project', async () => {
      dbSuccessGet(mockDb.get, sampleProject);
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ project: sampleProject });
    });

    test('returns 404 when not found', async () => {
      dbSuccessGet(mockDb.get, null);
      const res = await request(app).get('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).get('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('handles database error', async () => {
      dbErrorCallback(mockDb.get);
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    const validPayload = { name: 'New Project', startDate: '2024-01-15', status: 'active' };

    test('creates project without client', async () => {
      dbSuccessRun(mockDb.run, 1);
      dbSuccessGet(mockDb.get, { ...sampleProject, client_id: null, client_name: null });
      const res = await request(app).post('/api/projects').send(validPayload);
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
    });

    test('creates project with client assignment', async () => {
      dbSuccessGetOnce(mockDb.get, { id: 1 });
      dbSuccessRun(mockDb.run, 2);
      dbSuccessGetOnce(mockDb.get, sampleProject);
      const res = await request(app).post('/api/projects').send({ ...validPayload, clientId: 1 });
      expect(res.status).toBe(201);
    });

    test('rejects when assigned client not found', async () => {
      dbSuccessGet(mockDb.get, null);
      const res = await request(app).post('/api/projects').send({ ...validPayload, clientId: 999 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Client not found');
    });

    test('rejects missing required fields', async () => {
      const res = await request(app).post('/api/projects').send({ description: 'Missing fields' });
      expect(res.status).toBe(400);
    });

    test('rejects invalid status value', async () => {
      const res = await request(app).post('/api/projects').send({ ...validPayload, status: 'invalid' });
      expect(res.status).toBe(400);
    });

    test('handles insert database error', async () => {
      mockDb.run.mockImplementation(function(q, p, cb) { cb.call(this, new Error('DB error')); });
      const res = await request(app).post('/api/projects').send(validPayload);
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create project');
    });

    test('handles client verification database error', async () => {
      dbErrorCallback(mockDb.get);
      const res = await request(app).post('/api/projects').send({ ...validPayload, clientId: 1 });
      expect(res.status).toBe(500);
    });

    test('handles fetch-after-insert database error', async () => {
      dbSuccessRun(mockDb.run, 1);
      dbErrorCallback(mockDb.get);
      const res = await request(app).post('/api/projects').send(validPayload);
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Project created but failed to retrieve');
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('updates project with valid data', async () => {
      dbSuccessGetOnce(mockDb.get, { id: 1 });
      mockDb.run.mockImplementation(function(q, p, cb) { cb.call(this, null); });
      dbSuccessGetOnce(mockDb.get, { ...sampleProject, name: 'Updated', status: 'completed' });
      const res = await request(app).put('/api/projects/1').send({ name: 'Updated', status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project updated successfully');
    });

    test('returns 404 when project not found', async () => {
      dbSuccessGet(mockDb.get, null);
      const res = await request(app).put('/api/projects/999').send({ name: 'X' });
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).put('/api/projects/invalid').send({ name: 'X' });
      expect(res.status).toBe(400);
    });

    test('rejects empty update body', async () => {
      const res = await request(app).put('/api/projects/1').send({});
      expect(res.status).toBe(400);
    });

    test('rejects when updated client not found', async () => {
      dbSuccessGetOnce(mockDb.get, { id: 1 });
      dbSuccessGetOnce(mockDb.get, null);
      const res = await request(app).put('/api/projects/1').send({ clientId: 999 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Client not found');
    });

    test('handles existence check database error', async () => {
      dbErrorCallback(mockDb.get);
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
    });

    test('handles update database error', async () => {
      dbSuccessGetOnce(mockDb.get, { id: 1 });
      mockDb.run.mockImplementation(function(q, p, cb) { cb.call(this, new Error('DB error')); });
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update project');
    });

    test('handles fetch-after-update database error', async () => {
      // First get: findOwned returns the project
      dbSuccessGetOnce(mockDb.get, { id: 1 });
      // run: update succeeds
      mockDb.run.mockImplementation(function(q, p, cb) { cb.call(this, null); });
      // Second get: fetchProject fails
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(new Error('DB error')));
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Project updated but failed to retrieve');
    });

    test('handles client verification database error on update', async () => {
      dbSuccessGetOnce(mockDb.get, { id: 1 });
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(new Error('DB error')));
      const res = await request(app).put('/api/projects/1').send({ clientId: 1 });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('deletes project successfully', async () => {
      dbSuccessGet(mockDb.get, { id: 1 });
      mockDb.run.mockImplementation(function(q, p, cb) { cb.call(this, null); });
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project deleted successfully');
    });

    test('returns 404 when not found', async () => {
      dbSuccessGet(mockDb.get, null);
      const res = await request(app).delete('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).delete('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('handles existence check database error', async () => {
      dbErrorCallback(mockDb.get);
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });

    test('handles delete database error', async () => {
      dbSuccessGet(mockDb.get, { id: 1 });
      mockDb.run.mockImplementation(function(q, p, cb) { cb.call(this, new Error('DB error')); });
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete project');
    });
  });
});
