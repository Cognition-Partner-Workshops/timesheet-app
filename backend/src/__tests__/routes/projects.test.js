const request = require('supertest');
const projectRoutes = require('../../routes/projects');
const { createTestApp, createMockDb, mockDbAll, mockDbGet, mockDbGetOnce, mockDbRunWithLastID, mockDbRun } = require('../helpers/testApp');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const app = createTestApp('/api/projects', projectRoutes);

const SAMPLE_PROJECT = { id: 1, name: 'Project A', description: 'Desc A', client_id: 1, start_date: '2024-01-01', status: 'active', client_name: 'Client A', created_at: '2024-01-01', updated_at: '2024-01-01' };
const SAMPLE_PROJECT_B = { id: 2, name: 'Project B', description: 'Desc B', client_id: null, start_date: null, status: 'completed', client_name: null, created_at: '2024-01-02', updated_at: '2024-01-02' };

describe('Project Routes', () => {
  let mockDb;

  beforeEach(() => { mockDb = createMockDb(); });
  afterEach(() => { jest.clearAllMocks(); });

  describe('GET /api/projects', () => {
    test('should return all projects for authenticated user', async () => {
      mockDbAll(mockDb, [SAMPLE_PROJECT, SAMPLE_PROJECT_B]);
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(200);
      expect(response.body.projects).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('SELECT p.id, p.name'), ['test@example.com'], expect.any(Function));
    });

    test('should return empty array when no projects exist', async () => {
      mockDbAll(mockDb, []);
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: [] });
    });

    test('should handle database error', async () => {
      mockDbAll(mockDb, null, new Error('Database error'));
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project', async () => {
      mockDbGet(mockDb, SAMPLE_PROJECT);
      const response = await request(app).get('/api/projects/1');
      expect(response.status).toBe(200);
      expect(response.body.project.name).toBe('Project A');
    });

    test('should return 404 if project not found', async () => {
      mockDbGet(mockDb, null);
      const response = await request(app).get('/api/projects/999');
      expect(response.status).toBe(404);
    });

    test.each(['/api/projects/invalid', '/api/projects/abc'])('should return 400 for invalid ID: %s', async (url) => {
      const response = await request(app).get(url);
      expect(response.status).toBe(400);
    });

    test('should handle database error', async () => {
      mockDbGet(mockDb, null, new Error('Database error'));
      const response = await request(app).get('/api/projects/1');
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    test('should create project without client', async () => {
      const createdProject = { ...SAMPLE_PROJECT, client_id: null, client_name: null };
      mockDbRunWithLastID(mockDb, 1);
      mockDbGet(mockDb, createdProject);

      const response = await request(app).post('/api/projects').send({ name: 'Project A', status: 'active' });
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Project created successfully');
    });

    test('should create project with client assignment', async () => {
      mockDbGetOnce(mockDb, { id: 1 }); // client exists
      mockDbRunWithLastID(mockDb, 1);
      mockDbGetOnce(mockDb, SAMPLE_PROJECT);

      const response = await request(app).post('/api/projects').send({ name: 'Client Project', clientId: 1 });
      expect(response.status).toBe(201);
    });

    test('should reject invalid client assignment', async () => {
      mockDbGet(mockDb, null);
      const response = await request(app).post('/api/projects').send({ name: 'Project', clientId: 999 });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Client not found');
    });

    test.each([
      [{ description: 'No name' }, 'missing name'],
      [{ name: '' }, 'empty name'],
      [{ name: 'P', status: 'invalid' }, 'invalid status'],
    ])('should return 400 for %s', async (body) => {
      const response = await request(app).post('/api/projects').send(body);
      expect(response.status).toBe(400);
    });

    test('should handle database insert error', async () => {
      mockDb.run.mockImplementation((query, params, callback) => { callback(new Error('Insert failed')); });
      const response = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project name', async () => {
      const updated = { ...SAMPLE_PROJECT, name: 'Updated' };
      mockDbGetOnce(mockDb, { id: 1 }); // ownership
      mockDbRun(mockDb);
      mockDbGetOnce(mockDb, updated);

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project updated successfully');
    });

    test('should update project status', async () => {
      mockDbGetOnce(mockDb, { id: 1 });
      mockDbRun(mockDb);
      mockDbGetOnce(mockDb, { ...SAMPLE_PROJECT, status: 'completed' });

      const response = await request(app).put('/api/projects/1').send({ status: 'completed' });
      expect(response.status).toBe(200);
    });

    test('should update client assignment with validation', async () => {
      mockDbGetOnce(mockDb, { id: 1 }); // project exists
      mockDbGetOnce(mockDb, { id: 2 }); // new client exists
      mockDbRun(mockDb);
      mockDbGetOnce(mockDb, { ...SAMPLE_PROJECT, client_id: 2 });

      const response = await request(app).put('/api/projects/1').send({ clientId: 2 });
      expect(response.status).toBe(200);
    });

    test('should reject invalid client on update', async () => {
      mockDbGetOnce(mockDb, { id: 1 }); // project exists
      mockDbGetOnce(mockDb, null); // client does not exist

      const response = await request(app).put('/api/projects/1').send({ clientId: 999 });
      expect(response.status).toBe(400);
    });

    test('should return 404 if project not found', async () => {
      mockDbGet(mockDb, null);
      const response = await request(app).put('/api/projects/999').send({ name: 'X' });
      expect(response.status).toBe(404);
    });

    test.each([
      ['/api/projects/invalid', { name: 'X' }, 400],
      ['/api/projects/1', {}, 400],
      ['/api/projects/1', { status: 'bad' }, 400],
    ])('should return %i for PUT %s', async (url, body, expectedStatus) => {
      const response = await request(app).put(url).send(body);
      expect(response.status).toBe(expectedStatus);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete existing project', async () => {
      mockDbGetOnce(mockDb, { id: 1 });
      mockDbRun(mockDb);
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project deleted successfully');
    });

    test('should return 404 if project not found', async () => {
      mockDbGet(mockDb, null);
      const response = await request(app).delete('/api/projects/999');
      expect(response.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).delete('/api/projects/invalid');
      expect(response.status).toBe(400);
    });

    test('should handle database delete error', async () => {
      mockDbGetOnce(mockDb, { id: 1 });
      mockDb.run.mockImplementation((query, params, callback) => { callback(new Error('Delete failed')); });
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(500);
    });

    test('should handle database error on existence check', async () => {
      mockDbGet(mockDb, null, new Error('Database error'));
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(500);
    });
  });
});
