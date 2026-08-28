const request = require('supertest');
const express = require('express');
const projectRoutes = require('../../routes/projects');
const { dbAll, dbGet, dbRun, buildUpdateQuery } = require('../../database/helpers');

jest.mock('../../database/helpers');
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

afterEach(() => jest.clearAllMocks());

const sampleProject = { id: 1, name: 'Alpha', description: 'Desc', client_id: 1, start_date: '2024-01-01', status: 'active', client_name: 'Acme' };

describe('GET /api/projects', () => {
  it('returns all projects for the user', async () => {
    dbAll.mockResolvedValue([sampleProject]);
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
    expect(dbAll).toHaveBeenCalledWith(expect.stringContaining('user_email'), ['test@example.com']);
  });

  it('returns empty array when none exist', async () => {
    dbAll.mockResolvedValue([]);
    const res = await request(app).get('/api/projects');
    expect(res.body.projects).toEqual([]);
  });

  it('returns 500 on db failure', async () => {
    dbAll.mockRejectedValue(new Error('fail'));
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(500);
  });
});

describe('GET /api/projects/:id', () => {
  it('returns project by id', async () => {
    dbGet.mockResolvedValue(sampleProject);
    const res = await request(app).get('/api/projects/1');
    expect(res.body.project).toMatchObject({ name: 'Alpha' });
  });

  it('gives 404 for missing project', async () => {
    dbGet.mockResolvedValue(null);
    expect((await request(app).get('/api/projects/99')).status).toBe(404);
  });

  it('rejects non-numeric id', async () => {
    expect((await request(app).get('/api/projects/abc')).status).toBe(400);
  });

  it('handles db error', async () => {
    dbGet.mockRejectedValue(new Error('fail'));
    expect((await request(app).get('/api/projects/1')).status).toBe(500);
  });
});

describe('POST /api/projects', () => {
  it('creates a project with all fields', async () => {
    dbRun.mockResolvedValue({ lastID: 5 });
    dbGet.mockResolvedValue({ ...sampleProject, id: 5 });
    const res = await request(app).post('/api/projects').send({
      name: 'Alpha', description: 'Desc', clientId: 1, startDate: '2024-01-01', status: 'active'
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toContain('created');
  });

  it('defaults status to active when omitted', async () => {
    dbRun.mockResolvedValue({ lastID: 6 });
    dbGet.mockResolvedValue({ ...sampleProject, id: 6 });
    const res = await request(app).post('/api/projects').send({ name: 'Beta' });
    expect(res.status).toBe(201);
  });

  it('rejects missing name', async () => {
    const res = await request(app).post('/api/projects').send({ description: 'no name' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid status enum', async () => {
    const res = await request(app).post('/api/projects').send({ name: 'X', status: 'bad' });
    expect(res.status).toBe(400);
  });

  it('handles db insert error', async () => {
    dbRun.mockRejectedValue(new Error('fail'));
    const res = await request(app).post('/api/projects').send({ name: 'Y' });
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/projects/:id', () => {
  it('updates project fields', async () => {
    dbGet.mockResolvedValueOnce({ id: 1 });
    buildUpdateQuery.mockReturnValue({ query: 'UPDATE projects SET name=? WHERE id=? AND user_email=?', values: ['New', 1, 'test@example.com'] });
    dbRun.mockResolvedValue({ changes: 1 });
    dbGet.mockResolvedValueOnce({ ...sampleProject, name: 'New' });
    const res = await request(app).put('/api/projects/1').send({ name: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('New');
  });

  it('gives 404 for non-existent project', async () => {
    dbGet.mockResolvedValue(null);
    expect((await request(app).put('/api/projects/77').send({ name: 'Z' })).status).toBe(404);
  });

  it('rejects invalid id format', async () => {
    expect((await request(app).put('/api/projects/xyz').send({ name: 'Z' })).status).toBe(400);
  });

  it('rejects empty update body', async () => {
    expect((await request(app).put('/api/projects/1').send({})).status).toBe(400);
  });

  it('rejects bad status value', async () => {
    expect((await request(app).put('/api/projects/1').send({ status: 'nope' })).status).toBe(400);
  });

  it('handles db error gracefully', async () => {
    dbGet.mockRejectedValue(new Error('fail'));
    expect((await request(app).put('/api/projects/1').send({ name: 'Q' })).status).toBe(500);
  });
});

describe('DELETE /api/projects/:id', () => {
  it('deletes an existing project', async () => {
    dbGet.mockResolvedValue({ id: 1 });
    dbRun.mockResolvedValue({ changes: 1 });
    const res = await request(app).delete('/api/projects/1');
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');
  });

  it('gives 404 for missing project', async () => {
    dbGet.mockResolvedValue(null);
    expect((await request(app).delete('/api/projects/42')).status).toBe(404);
  });

  it('rejects non-numeric id', async () => {
    expect((await request(app).delete('/api/projects/bad')).status).toBe(400);
  });

  it('handles db check error', async () => {
    dbGet.mockRejectedValue(new Error('fail'));
    expect((await request(app).delete('/api/projects/1')).status).toBe(500);
  });

  it('handles db delete error', async () => {
    dbGet.mockResolvedValue({ id: 1 });
    dbRun.mockRejectedValue(new Error('fail'));
    expect((await request(app).delete('/api/projects/1')).status).toBe(500);
  });
});
