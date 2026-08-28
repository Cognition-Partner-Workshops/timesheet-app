const request = require('supertest');
const express = require('express');
const projectRoutes = require('../../routes/projects');

jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const mockFindAll = jest.fn();
const mockFindOne = jest.fn();
const mockRunQuery = jest.fn();
const mockBuildUpdateQuery = jest.fn();

jest.mock('../../database/helpers', () => ({
  findAll: (...args) => mockFindAll(...args),
  findOne: (...args) => mockFindOne(...args),
  runQuery: (...args) => mockRunQuery(...args),
  buildUpdateQuery: (...args) => mockBuildUpdateQuery(...args)
}));

const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);
app.use((err, req, res, next) => {
  if (err.isJoi) return res.status(400).json({ error: 'Validation error' });
  res.status(500).json({ error: 'Internal server error' });
});

describe('Project Routes', () => {
  afterEach(() => jest.clearAllMocks());

  describe('GET /api/projects', () => {
    test('returns all projects for authenticated user', async () => {
      const projects = [
        { id: 1, name: 'Alpha', status: 'active', client_name: 'Acme' },
        { id: 2, name: 'Beta', status: 'on-hold', client_name: null }
      ];
      mockFindAll.mockResolvedValue(projects);

      const res = await request(app).get('/api/projects');

      expect(res.status).toBe(200);
      expect(res.body.projects).toEqual(projects);
      expect(mockFindAll).toHaveBeenCalledWith(expect.stringContaining('WHERE p.user_email'), ['test@example.com']);
    });

    test('returns empty array when none exist', async () => {
      mockFindAll.mockResolvedValue([]);
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.projects).toEqual([]);
    });

    test('handles database error', async () => {
      mockFindAll.mockRejectedValue(new Error('DB failure'));
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error');
    });
  });

  describe('GET /api/projects/:id', () => {
    test('returns specific project by id', async () => {
      const project = { id: 1, name: 'Alpha', status: 'active' };
      mockFindOne.mockResolvedValue(project);

      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body.project).toEqual(project);
    });

    test('returns 404 when not found', async () => {
      mockFindOne.mockResolvedValue(null);
      const res = await request(app).get('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('returns 400 for non-numeric id', async () => {
      const res = await request(app).get('/api/projects/abc');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid project ID');
    });

    test('handles database error', async () => {
      mockFindOne.mockRejectedValue(new Error('DB failure'));
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    test('creates project with all fields', async () => {
      const created = { id: 1, name: 'New', status: 'active', client_name: 'Acme' };
      // First findOne: client ownership check
      mockFindOne.mockResolvedValueOnce({ id: 1 });
      mockRunQuery.mockResolvedValue({ lastID: 1 });
      // Second findOne: fetch created project
      mockFindOne.mockResolvedValueOnce(created);

      const res = await request(app).post('/api/projects').send({
        name: 'New', description: 'Desc', clientId: 1, startDate: '2024-06-01', status: 'active'
      });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
      expect(res.body.project).toEqual(created);
    });

    test('rejects clientId that does not belong to user', async () => {
      mockFindOne.mockResolvedValue(null);
      const res = await request(app).post('/api/projects').send({ name: 'X', clientId: 999 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Client not found or does not belong to you');
    });

    test('defaults status to active when omitted', async () => {
      mockRunQuery.mockResolvedValue({ lastID: 2 });
      mockFindOne.mockResolvedValue({ id: 2, name: 'Min', status: 'active' });

      const res = await request(app).post('/api/projects').send({ name: 'Min' });
      expect(res.status).toBe(201);
      expect(mockRunQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        ['Min', null, null, null, 'active', 'test@example.com']
      );
    });

    test('rejects missing name', async () => {
      const res = await request(app).post('/api/projects').send({ description: 'no name' });
      expect(res.status).toBe(400);
    });

    test('rejects invalid status', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'X', status: 'bogus' });
      expect(res.status).toBe(400);
    });

    test('handles insert failure', async () => {
      mockRunQuery.mockRejectedValue(new Error('DB failure'));
      const res = await request(app).post('/api/projects').send({ name: 'Fail' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create project');
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('updates project fields', async () => {
      const updated = { id: 1, name: 'Renamed', status: 'completed' };
      mockFindOne.mockResolvedValueOnce({ id: 1 });
      mockBuildUpdateQuery.mockReturnValue({ query: 'UPDATE projects SET name = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?', values: ['Renamed', 'completed'] });
      mockRunQuery.mockResolvedValue({ changes: 1 });
      mockFindOne.mockResolvedValueOnce(updated);

      const res = await request(app).put('/api/projects/1').send({ name: 'Renamed', status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.project).toEqual(updated);
    });

    test('rejects clientId that does not belong to user on update', async () => {
      // First findOne: project exists
      mockFindOne.mockResolvedValueOnce({ id: 1 });
      // Second findOne: client ownership check fails
      mockFindOne.mockResolvedValueOnce(null);

      const res = await request(app).put('/api/projects/1').send({ clientId: 999 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Client not found or does not belong to you');
    });

    test('returns 404 for non-existent project', async () => {
      mockFindOne.mockResolvedValue(null);
      const res = await request(app).put('/api/projects/999').send({ name: 'X' });
      expect(res.status).toBe(404);
    });

    test('returns 400 for non-numeric id', async () => {
      const res = await request(app).put('/api/projects/xyz').send({ name: 'X' });
      expect(res.status).toBe(400);
    });

    test('rejects empty body', async () => {
      const res = await request(app).put('/api/projects/1').send({});
      expect(res.status).toBe(400);
    });

    test('rejects invalid status value', async () => {
      const res = await request(app).put('/api/projects/1').send({ status: 'nope' });
      expect(res.status).toBe(400);
    });

    test('handles update failure', async () => {
      mockFindOne.mockResolvedValueOnce({ id: 1 });
      mockBuildUpdateQuery.mockReturnValue({ query: 'UPDATE ...', values: ['x'] });
      mockRunQuery.mockRejectedValue(new Error('DB failure'));

      const res = await request(app).put('/api/projects/1').send({ name: 'x' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update project');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('deletes project successfully', async () => {
      mockFindOne.mockResolvedValue({ id: 1 });
      mockRunQuery.mockResolvedValue({ changes: 1 });

      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project deleted successfully');
    });

    test('returns 404 for non-existent project', async () => {
      mockFindOne.mockResolvedValue(null);
      const res = await request(app).delete('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('returns 400 for non-numeric id', async () => {
      const res = await request(app).delete('/api/projects/abc');
      expect(res.status).toBe(400);
    });

    test('handles database error on lookup', async () => {
      mockFindOne.mockRejectedValue(new Error('DB failure'));
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });

    test('handles database error on delete', async () => {
      mockFindOne.mockResolvedValue({ id: 1 });
      mockRunQuery.mockRejectedValue(new Error('DB failure'));
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete project');
    });
  });
});
