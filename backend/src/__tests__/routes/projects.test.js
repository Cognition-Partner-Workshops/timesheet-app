const request = require('supertest');
const express = require('express');
const projectRoutes = require('../../routes/projects');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

jest.mock('../../database/helpers', () => ({
  dbAll: jest.fn(),
  dbGet: jest.fn(),
  dbRun: jest.fn(),
  buildUpdateQuery: jest.fn()
}));

const mockHelpers = require('../../database/helpers');

const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);
app.use((err, req, res, next) => {
  if (err.isJoi) return res.status(400).json({ error: 'Validation error' });
  res.status(500).json({ error: 'Internal server error' });
});

const sampleProject = {
  id: 1,
  name: 'Project Alpha',
  description: 'Alpha description',
  client_id: 1,
  client_name: 'Client A',
  start_date: '2024-06-01',
  status: 'active',
  created_at: '2024-01-01',
  updated_at: '2024-01-01'
};

beforeEach(() => jest.clearAllMocks());

describe('GET /api/projects', () => {
  it('returns all projects for user', async () => {
    mockHelpers.dbAll.mockResolvedValue([sampleProject]);
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].name).toBe('Project Alpha');
  });

  it('returns empty list when none exist', async () => {
    mockHelpers.dbAll.mockResolvedValue([]);
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.projects).toEqual([]);
  });

  it('handles db failure', async () => {
    mockHelpers.dbAll.mockRejectedValue(new Error('db down'));
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(500);
  });
});

describe('GET /api/projects/:id', () => {
  it('returns a single project', async () => {
    mockHelpers.dbGet.mockResolvedValue(sampleProject);
    const res = await request(app).get('/api/projects/1');
    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('Project Alpha');
  });

  it('rejects non-numeric id', async () => {
    const res = await request(app).get('/api/projects/abc');
    expect(res.status).toBe(400);
  });

  it('returns 404 for missing project', async () => {
    mockHelpers.dbGet.mockResolvedValue(null);
    const res = await request(app).get('/api/projects/999');
    expect(res.status).toBe(404);
  });

  it('handles db failure', async () => {
    mockHelpers.dbGet.mockRejectedValue(new Error('db down'));
    const res = await request(app).get('/api/projects/1');
    expect(res.status).toBe(500);
  });
});

describe('POST /api/projects', () => {
  it('creates a project with all fields', async () => {
    mockHelpers.dbRun.mockResolvedValue({ lastID: 5 });
    mockHelpers.dbGet.mockResolvedValue({ ...sampleProject, id: 5 });

    const res = await request(app).post('/api/projects').send({
      name: 'Project Alpha',
      description: 'Alpha description',
      clientId: 1,
      startDate: '2024-06-01',
      status: 'active'
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Project created successfully');
    expect(res.body.project.id).toBe(5);
  });

  it('creates a project with only required name field', async () => {
    mockHelpers.dbRun.mockResolvedValue({ lastID: 6 });
    mockHelpers.dbGet.mockResolvedValue({ id: 6, name: 'Minimal', status: 'active' });

    const res = await request(app).post('/api/projects').send({ name: 'Minimal' });
    expect(res.status).toBe(201);
  });

  it('rejects missing name', async () => {
    const res = await request(app).post('/api/projects').send({ description: 'no name' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid status value', async () => {
    const res = await request(app).post('/api/projects').send({ name: 'X', status: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('handles insert failure', async () => {
    mockHelpers.dbRun.mockRejectedValue(new Error('insert failed'));
    const res = await request(app).post('/api/projects').send({ name: 'Fail' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to create project');
  });

  it('handles retrieval failure after insert', async () => {
    mockHelpers.dbRun.mockResolvedValue({ lastID: 7 });
    mockHelpers.dbGet.mockResolvedValue(null);

    const res = await request(app).post('/api/projects').send({ name: 'Lost' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Project created but failed to retrieve');
  });
});

describe('PUT /api/projects/:id', () => {
  it('updates name and status', async () => {
    mockHelpers.dbGet
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ ...sampleProject, name: 'Renamed', status: 'completed' });
    mockHelpers.buildUpdateQuery.mockReturnValue({ sql: 'UPDATE ...', params: [] });
    mockHelpers.dbRun.mockResolvedValue({ changes: 1 });

    const res = await request(app).put('/api/projects/1').send({ name: 'Renamed', status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Project updated successfully');
  });

  it('rejects non-numeric id', async () => {
    const res = await request(app).put('/api/projects/abc').send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent project', async () => {
    mockHelpers.dbGet.mockResolvedValue(null);
    const res = await request(app).put('/api/projects/999').send({ name: 'Ghost' });
    expect(res.status).toBe(404);
  });

  it('rejects empty body', async () => {
    const res = await request(app).put('/api/projects/1').send({});
    expect(res.status).toBe(400);
  });

  it('handles db failure on existence check', async () => {
    mockHelpers.dbGet.mockRejectedValue(new Error('db down'));
    const res = await request(app).put('/api/projects/1').send({ name: 'X' });
    expect(res.status).toBe(500);
  });

  it('handles db failure on update run', async () => {
    mockHelpers.dbGet.mockResolvedValueOnce({ id: 1 });
    mockHelpers.buildUpdateQuery.mockReturnValue({ sql: 'UPDATE ...', params: [] });
    mockHelpers.dbRun.mockRejectedValue(new Error('write failed'));

    const res = await request(app).put('/api/projects/1').send({ name: 'X' });
    expect(res.status).toBe(500);
  });

  it('handles retrieval failure after update', async () => {
    mockHelpers.dbGet
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce(null);
    mockHelpers.buildUpdateQuery.mockReturnValue({ sql: 'UPDATE ...', params: [] });
    mockHelpers.dbRun.mockResolvedValue({ changes: 1 });

    const res = await request(app).put('/api/projects/1').send({ name: 'X' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Project updated but failed to retrieve');
  });
});

describe('DELETE /api/projects/:id', () => {
  it('deletes an existing project', async () => {
    mockHelpers.dbGet.mockResolvedValue({ id: 1 });
    mockHelpers.dbRun.mockResolvedValue({ changes: 1 });

    const res = await request(app).delete('/api/projects/1');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Project deleted successfully');
  });

  it('rejects non-numeric id', async () => {
    const res = await request(app).delete('/api/projects/abc');
    expect(res.status).toBe(400);
  });

  it('returns 404 when project not found', async () => {
    mockHelpers.dbGet.mockResolvedValue(null);
    const res = await request(app).delete('/api/projects/999');
    expect(res.status).toBe(404);
  });

  it('handles db failure on existence check', async () => {
    mockHelpers.dbGet.mockRejectedValue(new Error('db down'));
    const res = await request(app).delete('/api/projects/1');
    expect(res.status).toBe(500);
  });

  it('handles db failure on delete', async () => {
    mockHelpers.dbGet.mockResolvedValue({ id: 1 });
    mockHelpers.dbRun.mockRejectedValue(new Error('delete failed'));

    const res = await request(app).delete('/api/projects/1');
    expect(res.status).toBe(500);
  });
});
