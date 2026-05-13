const request = require('supertest');
const projectRoutes = require('../../routes/projects');
const { createTestApp, createMockDb } = require('../helpers/routeTestSetup');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => { req.userEmail = 'test@example.com'; next(); }
}));

const app = createTestApp('/api/projects', projectRoutes);

const SAMPLE_PROJECT = {
  id: 1, name: 'Project A', description: 'Desc A',
  client_id: 1, start_date: '2024-01-01', status: 'active',
  client_name: 'Client A', created_at: '2024-01-01', updated_at: '2024-01-01'
};

describe('Project Routes', () => {
  let mockDb;

  beforeEach(() => { mockDb = createMockDb(); });
  afterEach(() => jest.clearAllMocks());

  describe('GET /api/projects', () => {
    test('returns all projects for authenticated user', async () => {
      const projects = [SAMPLE_PROJECT, { ...SAMPLE_PROJECT, id: 2, name: 'Project B', status: 'on-hold', client_id: null, client_name: null }];
      mockDb.all.mockImplementation((q, p, cb) => cb(null, projects));

      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.projects).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('SELECT p.id'), ['test@example.com'], expect.any(Function));
    });

    test('returns empty array when none exist', async () => {
      mockDb.all.mockImplementation((q, p, cb) => cb(null, []));
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: [] });
    });

    test('handles database error', async () => {
      mockDb.all.mockImplementation((q, p, cb) => cb(new Error('fail')));
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('returns specific project', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, SAMPLE_PROJECT));
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body.project.name).toBe('Project A');
    });

    test('returns 404 when not found', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, null));
      const res = await request(app).get('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).get('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('handles database error', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(new Error('fail')));
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    function mockSuccessfulCreate(project = SAMPLE_PROJECT) {
      mockDb.run.mockImplementation(function(q, p, cb) { this.lastID = project.id; cb.call(this, null); });
      mockDb.get.mockImplementation((q, p, cb) => cb(null, project));
    }

    test('creates project with valid data', async () => {
      mockSuccessfulCreate();
      const res = await request(app).post('/api/projects').send({ name: 'Project A', description: 'Desc A', status: 'active' });
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
      expect(res.body.project.name).toBe('Project A');
    });

    test('creates project with client assignment', async () => {
      const withClient = { ...SAMPLE_PROJECT, id: 2 };
      mockSuccessfulCreate(withClient);
      const res = await request(app).post('/api/projects').send({ name: 'Client Project', clientId: 1, startDate: '2024-06-01' });
      expect(res.status).toBe(201);
      expect(res.body.project.client_id).toBe(1);
    });

    test('rejects missing name', async () => {
      const res = await request(app).post('/api/projects').send({ description: 'No name' });
      expect(res.status).toBe(400);
    });

    test('rejects invalid status', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'Test', status: 'invalid' });
      expect(res.status).toBe(400);
    });

    test('handles insert database error', async () => {
      mockDb.run.mockImplementation(function(q, p, cb) { cb.call(this, new Error('fail')); });
      const res = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create project');
    });

    test('handles retrieve-after-create database error', async () => {
      mockDb.run.mockImplementation(function(q, p, cb) { this.lastID = 1; cb.call(this, null); });
      mockDb.get.mockImplementation((q, p, cb) => cb(new Error('fail')));
      const res = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Project created but failed to retrieve');
    });
  });

  describe('PUT /api/projects/:id', () => {
    function mockExistsAndUpdate(updated = { ...SAMPLE_PROJECT, status: 'completed' }) {
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation(function(q, p, cb) { cb.call(this, null); });
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, updated));
    }

    test('updates project with valid data', async () => {
      mockExistsAndUpdate();
      const res = await request(app).put('/api/projects/1').send({ name: 'Updated', status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project updated successfully');
    });

    test('returns 404 when not found', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, null));
      const res = await request(app).put('/api/projects/999').send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).put('/api/projects/invalid').send({ name: 'X' });
      expect(res.status).toBe(400);
    });

    test('rejects empty body', async () => {
      const res = await request(app).put('/api/projects/1').send({});
      expect(res.status).toBe(400);
    });

    test('handles existence-check database error', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(new Error('fail')));
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
    });

    test('handles update database error', async () => {
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation(function(q, p, cb) { cb.call(this, new Error('fail')); });
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update project');
    });

    test('handles retrieve-after-update database error', async () => {
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation(function(q, p, cb) { cb.call(this, null); });
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(new Error('fail')));
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Project updated but failed to retrieve');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('deletes existing project', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation(function(q, p, cb) { cb.call(this, null); });
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project deleted successfully');
    });

    test('returns 404 when not found', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, null));
      const res = await request(app).delete('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).delete('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('handles existence-check database error', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(new Error('fail')));
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });

    test('handles delete database error', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, { id: 1 }));
      mockDb.run.mockImplementation(function(q, p, cb) { cb.call(this, new Error('fail')); });
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete project');
    });
  });
});
