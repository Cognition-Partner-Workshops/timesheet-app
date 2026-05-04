const request = require('supertest');
const express = require('express');
const projectRoutes = require('../../routes/projects');
const { getDatabase } = require('../../database/init');
const {
  createMockDb, mockDbAll, mockDbGet, mockDbGetOnce,
  mockDbRunSuccess, mockDbRunError
} = require('../helpers/testUtils');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => { req.userEmail = 'test@example.com'; next(); }
}));

const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);
app.use((err, req, res, next) => {
  if (err.isJoi) return res.status(400).json({ error: 'Validation error' });
  res.status(500).json({ error: 'Internal server error' });
});

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
    test('returns all projects for authenticated user', async () => {
      const projects = [SAMPLE_PROJECT, { ...SAMPLE_PROJECT, id: 2, name: 'Project B', status: 'completed', client_name: null }];
      mockDbAll(mockDb, projects);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.projects).toEqual(projects);
    });

    test('returns empty array when none exist', async () => {
      mockDbAll(mockDb, []);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: [] });
    });

    test('handles database error', async () => {
      mockDbAll(mockDb, null, new Error('Database error'));
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('returns specific project', async () => {
      mockDbGet(mockDb, SAMPLE_PROJECT);
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ project: SAMPLE_PROJECT });
    });

    test('returns 404 if not found', async () => {
      mockDbGet(mockDb, null);
      const res = await request(app).get('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).get('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('handles database error', async () => {
      mockDbGet(mockDb, null, new Error('Database error'));
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    test('creates project with all fields', async () => {
      // First db.get: ownership check for clientId
      mockDbGetOnce(mockDb, { id: 1 });
      mockDbRunSuccess(mockDb, { lastID: 1 });
      // Second db.get: retrieve created project
      mockDbGetOnce(mockDb, SAMPLE_PROJECT);
      const res = await request(app).post('/api/projects')
        .send({ name: 'New Project', description: 'Desc', clientId: 1, startDate: '2024-01-15', status: 'active' });
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
    });

    test('creates project with only name (defaults status to active)', async () => {
      const minimal = { ...SAMPLE_PROJECT, description: null, client_id: null, start_date: null, client_name: null };
      mockDbRunSuccess(mockDb, { lastID: 1 });
      mockDbGet(mockDb, minimal);
      const res = await request(app).post('/api/projects').send({ name: 'Minimal' });
      expect(res.status).toBe(201);
      expect(res.body.project.status).toBe('active');
    });

    test('rejects clientId not belonging to user', async () => {
      mockDbGetOnce(mockDb, null); // ownership check returns no row
      const res = await request(app).post('/api/projects')
        .send({ name: 'Test', clientId: 999 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Client not found/);
    });

    test('rejects missing name', async () => {
      const res = await request(app).post('/api/projects').send({ description: 'No name' });
      expect(res.status).toBe(400);
    });

    test('rejects invalid status', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'Test', status: 'invalid' });
      expect(res.status).toBe(400);
    });

    test('handles insert error', async () => {
      mockDbRunError(mockDb);
      const res = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(res.status).toBe(500);
    });

    test('handles retrieve-after-create error', async () => {
      mockDbRunSuccess(mockDb, { lastID: 1 });
      mockDbGet(mockDb, null, new Error('Database error'));
      const res = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('updates project with valid data', async () => {
      const updated = { ...SAMPLE_PROJECT, name: 'Updated', status: 'completed' };
      mockDbGetOnce(mockDb, { id: 1 });
      mockDbRunSuccess(mockDb);
      mockDbGetOnce(mockDb, updated);
      const res = await request(app).put('/api/projects/1').send({ name: 'Updated', status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project updated successfully');
    });

    test('returns 404 if not found', async () => {
      mockDbGet(mockDb, null);
      const res = await request(app).put('/api/projects/999').send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).put('/api/projects/invalid').send({ name: 'Updated' });
      expect(res.status).toBe(400);
    });

    test('rejects clientId not belonging to user on update', async () => {
      mockDbGetOnce(mockDb, null); // ownership check returns no row
      const res = await request(app).put('/api/projects/1').send({ clientId: 999 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Client not found/);
    });

    test('rejects empty body', async () => {
      const res = await request(app).put('/api/projects/1').send({});
      expect(res.status).toBe(400);
    });

    test('rejects invalid status', async () => {
      const res = await request(app).put('/api/projects/1').send({ status: 'not-valid' });
      expect(res.status).toBe(400);
    });

    test('handles existence-check error', async () => {
      mockDbGet(mockDb, null, new Error('Database error'));
      const res = await request(app).put('/api/projects/1').send({ name: 'Updated' });
      expect(res.status).toBe(500);
    });

    test('handles update error', async () => {
      mockDbGetOnce(mockDb, { id: 1 });
      mockDbRunError(mockDb);
      const res = await request(app).put('/api/projects/1').send({ name: 'Updated' });
      expect(res.status).toBe(500);
    });

    test('handles retrieve-after-update error', async () => {
      mockDbGetOnce(mockDb, { id: 1 });
      mockDbRunSuccess(mockDb);
      mockDbGetOnce(mockDb, null, new Error('Database error'));
      const res = await request(app).put('/api/projects/1').send({ name: 'Updated' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/projects', () => {
    test('deletes all projects for user', async () => {
      mockDbRunSuccess(mockDb, { changes: 3 });
      const res = await request(app).delete('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.deletedCount).toBe(3);
    });

    test('handles database error', async () => {
      mockDbRunError(mockDb);
      const res = await request(app).delete('/api/projects');
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('deletes specific project', async () => {
      mockDbGet(mockDb, { id: 1 });
      mockDbRunSuccess(mockDb);
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project deleted successfully');
    });

    test('returns 404 if not found', async () => {
      mockDbGet(mockDb, null);
      const res = await request(app).delete('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).delete('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('handles existence-check error', async () => {
      mockDbGet(mockDb, null, new Error('Database error'));
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });

    test('handles delete error', async () => {
      mockDbGet(mockDb, { id: 1 });
      mockDbRunError(mockDb);
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });
});
