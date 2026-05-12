const request = require('supertest');
const projectRoutes = require('../../routes/projects');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const { createTestApp, createMockDb, mockDbAll, mockDbGet, mockDbRun, mockDbGetSequence } = require('../helpers/testApp');

const app = createTestApp('/api/projects', projectRoutes);

describe('Project Routes', () => {
  let mockDb;

  beforeEach(() => { mockDb = createMockDb(); });
  afterEach(() => { jest.clearAllMocks(); });

  describe('GET /api/projects', () => {
    test('should return all projects for authenticated user', async () => {
      const mockProjects = [
        { id: 1, name: 'Project A', status: 'active', client_name: 'Client A' },
        { id: 2, name: 'Project B', status: 'on-hold', client_name: null }
      ];
      mockDbAll(mockDb, mockProjects);

      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(200);
      expect(response.body.projects).toEqual(mockProjects);
    });

    test('should return empty array when no projects exist', async () => {
      mockDbAll(mockDb, []);
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(200);
      expect(response.body.projects).toEqual([]);
    });

    test('should handle database error', async () => {
      mockDbAll(mockDb, null, new Error('Database error'));
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project', async () => {
      const mockProject = { id: 1, name: 'Project A', status: 'active' };
      mockDbGet(mockDb, mockProject);

      const response = await request(app).get('/api/projects/1');
      expect(response.status).toBe(200);
      expect(response.body.project).toEqual(mockProject);
    });

    test('should return 404 if project not found', async () => {
      mockDbGet(mockDb, null);
      const response = await request(app).get('/api/projects/999');
      expect(response.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).get('/api/projects/invalid');
      expect(response.status).toBe(400);
    });

    test('should handle database error', async () => {
      mockDbGet(mockDb, null, new Error('Database error'));
      const response = await request(app).get('/api/projects/1');
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    test('should create new project with valid data', async () => {
      const created = { id: 1, name: 'New Project', status: 'active', client_name: null };
      mockDbRun(mockDb, null, 1);
      mockDbGet(mockDb, created);

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'New Project', description: 'Description', status: 'active' });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.project).toEqual(created);
    });

    test('should create project with client assignment and start date', async () => {
      const created = { id: 2, name: 'Assigned', client_id: 1, start_date: '2024-06-01', status: 'active' };
      mockDbRun(mockDb, null, 2);
      mockDbGet(mockDb, created);

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Assigned', clientId: 1, startDate: '2024-06-01', status: 'active' });

      expect(response.status).toBe(201);
      expect(response.body.project.client_id).toBe(1);
    });

    test('should reject project without name', async () => {
      const response = await request(app).post('/api/projects').send({ description: 'No name' });
      expect(response.status).toBe(400);
    });

    test('should reject project with invalid status', async () => {
      const response = await request(app).post('/api/projects').send({ name: 'Test', status: 'invalid' });
      expect(response.status).toBe(400);
    });

    test('should handle database error on create', async () => {
      mockDbRun(mockDb, new Error('Database error'));
      const response = await request(app).post('/api/projects').send({ name: 'Test Project' });
      expect(response.status).toBe(500);
    });

    test('should handle database error on retrieve after create', async () => {
      mockDbRun(mockDb, null, 1);
      mockDbGet(mockDb, null, new Error('Database error'));

      const response = await request(app).post('/api/projects').send({ name: 'Test Project' });
      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project with valid data', async () => {
      const updated = { id: 1, name: 'Updated', status: 'completed' };
      mockDbGetSequence(mockDb, [
        { data: { id: 1 } },
        { data: updated }
      ]);
      mockDbRun(mockDb);

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated', status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project updated successfully');
    });

    test('should return 404 if project not found', async () => {
      mockDbGet(mockDb, null);
      const response = await request(app).put('/api/projects/999').send({ name: 'Updated' });
      expect(response.status).toBe(404);
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).put('/api/projects/invalid').send({ name: 'Updated' });
      expect(response.status).toBe(400);
    });

    test('should reject update with no fields', async () => {
      const response = await request(app).put('/api/projects/1').send({});
      expect(response.status).toBe(400);
    });

    test('should reject update with invalid status', async () => {
      const response = await request(app).put('/api/projects/1').send({ status: 'invalid' });
      expect(response.status).toBe(400);
    });

    test('should handle database error on existence check', async () => {
      mockDbGet(mockDb, null, new Error('Database error'));
      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });
      expect(response.status).toBe(500);
    });

    test('should handle database error on update', async () => {
      mockDbGet(mockDb, { id: 1 });
      mockDbRun(mockDb, new Error('Database error'));
      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });
      expect(response.status).toBe(500);
    });

    test('should handle database error on retrieve after update', async () => {
      mockDbGetSequence(mockDb, [
        { data: { id: 1 } },
        { err: new Error('Database error'), data: null }
      ]);
      mockDbRun(mockDb);
      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });
      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project successfully', async () => {
      mockDbGet(mockDb, { id: 1 });
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

    test('should handle database error on existence check', async () => {
      mockDbGet(mockDb, null, new Error('Database error'));
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(500);
    });

    test('should handle database error on delete', async () => {
      mockDbGet(mockDb, { id: 1 });
      mockDbRun(mockDb, new Error('Database error'));
      const response = await request(app).delete('/api/projects/1');
      expect(response.status).toBe(500);
    });
  });
});
