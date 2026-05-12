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

const helpers = require('../../routes/helpers');
jest.mock('../../routes/helpers', () => ({
  validateId: jest.fn((req) => {
    const id = parseInt(req.params.id);
    return isNaN(id) ? null : id;
  }),
  dbAll: jest.fn(),
  dbGet: jest.fn(),
  dbRun: jest.fn(),
  buildUpdateQuery: jest.fn()
}));

const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);
app.use((err, req, res, next) => {
  if (err.isJoi) return res.status(400).json({ error: 'Validation error' });
  res.status(500).json({ error: 'Internal server error' });
});

const sampleProject = {
  id: 1, name: 'Alpha', description: 'First project',
  client_id: 1, start_date: '2024-01-15', status: 'active',
  client_name: 'Acme Corp', created_at: '2024-01-01', updated_at: '2024-01-01'
};

beforeEach(() => jest.clearAllMocks());

describe('GET /api/projects', () => {
  it('returns all projects', async () => {
    helpers.dbAll.mockResolvedValue([sampleProject]);
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.projects).toEqual([sampleProject]);
  });

  it('returns empty list', async () => {
    helpers.dbAll.mockResolvedValue([]);
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.projects).toEqual([]);
  });

  it('handles db failure', async () => {
    helpers.dbAll.mockRejectedValue(new Error('fail'));
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(500);
  });
});

describe('GET /api/projects/:id', () => {
  it('returns a project by id', async () => {
    helpers.dbGet.mockResolvedValue(sampleProject);
    const res = await request(app).get('/api/projects/1');
    expect(res.status).toBe(200);
    expect(res.body.project).toEqual(sampleProject);
  });

  it('404 when not found', async () => {
    helpers.dbGet.mockResolvedValue(null);
    const res = await request(app).get('/api/projects/999');
    expect(res.status).toBe(404);
  });

  it('400 for non-numeric id', async () => {
    helpers.validateId.mockReturnValueOnce(null);
    const res = await request(app).get('/api/projects/abc');
    expect(res.status).toBe(400);
  });

  it('handles db failure', async () => {
    helpers.dbGet.mockRejectedValue(new Error('fail'));
    const res = await request(app).get('/api/projects/1');
    expect(res.status).toBe(500);
  });
});

describe('POST /api/projects', () => {
  it('creates a project', async () => {
    helpers.dbRun.mockResolvedValue({ lastID: 1 });
    helpers.dbGet.mockResolvedValue(sampleProject);
    const res = await request(app).post('/api/projects').send({ name: 'Alpha', status: 'active' });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Project created successfully');
    expect(res.body.project).toEqual(sampleProject);
  });

  it('creates with client and date', async () => {
    helpers.dbRun.mockResolvedValue({ lastID: 2 });
    helpers.dbGet.mockResolvedValue({ ...sampleProject, id: 2 });
    const res = await request(app).post('/api/projects')
      .send({ name: 'Beta', clientId: 1, startDate: '2024-06-01', status: 'on-hold' });
    expect(res.status).toBe(201);
  });

  it('rejects missing name', async () => {
    const res = await request(app).post('/api/projects').send({ description: 'no name' });
    expect(res.status).toBe(400);
  });

  it('rejects empty name', async () => {
    const res = await request(app).post('/api/projects').send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid status', async () => {
    const res = await request(app).post('/api/projects').send({ name: 'X', status: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('handles db insert failure', async () => {
    helpers.dbRun.mockRejectedValue(new Error('insert fail'));
    const res = await request(app).post('/api/projects').send({ name: 'Fail' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to create project');
  });
});

describe('PUT /api/projects/:id', () => {
  it('updates name', async () => {
    helpers.dbGet.mockResolvedValueOnce({ id: 1 });
    helpers.buildUpdateQuery.mockReturnValue({ query: 'UPDATE projects SET name = ? WHERE id = ? AND user_email = ?', values: ['New', 1, 'test@example.com'] });
    helpers.dbRun.mockResolvedValue({});
    helpers.dbGet.mockResolvedValueOnce({ ...sampleProject, name: 'New' });
    const res = await request(app).put('/api/projects/1').send({ name: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Project updated successfully');
  });

  it('updates status', async () => {
    helpers.dbGet.mockResolvedValueOnce({ id: 1 });
    helpers.buildUpdateQuery.mockReturnValue({ query: 'UPDATE ...', values: [] });
    helpers.dbRun.mockResolvedValue({});
    helpers.dbGet.mockResolvedValueOnce({ ...sampleProject, status: 'completed' });
    const res = await request(app).put('/api/projects/1').send({ status: 'completed' });
    expect(res.status).toBe(200);
  });

  it('404 when not found', async () => {
    helpers.dbGet.mockResolvedValue(null);
    const res = await request(app).put('/api/projects/999').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('400 for invalid id', async () => {
    helpers.validateId.mockReturnValueOnce(null);
    const res = await request(app).put('/api/projects/abc').send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('400 for empty body', async () => {
    const res = await request(app).put('/api/projects/1').send({});
    expect(res.status).toBe(400);
  });

  it('400 for invalid status value', async () => {
    const res = await request(app).put('/api/projects/1').send({ status: 'nope' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/projects/:id', () => {
  it('deletes a project', async () => {
    helpers.dbGet.mockResolvedValue({ id: 1 });
    helpers.dbRun.mockResolvedValue({});
    const res = await request(app).delete('/api/projects/1');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Project deleted successfully');
  });

  it('404 when not found', async () => {
    helpers.dbGet.mockResolvedValue(null);
    const res = await request(app).delete('/api/projects/999');
    expect(res.status).toBe(404);
  });

  it('400 for invalid id', async () => {
    helpers.validateId.mockReturnValueOnce(null);
    const res = await request(app).delete('/api/projects/abc');
    expect(res.status).toBe(400);
  });

  it('handles db failure', async () => {
    helpers.dbGet.mockResolvedValue({ id: 1 });
    helpers.dbRun.mockRejectedValue(new Error('fail'));
    const res = await request(app).delete('/api/projects/1');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to delete project');
  });
});

describe('DELETE /api/projects (bulk)', () => {
  it('deletes all projects', async () => {
    helpers.dbRun.mockResolvedValue({ changes: 5 });
    const res = await request(app).delete('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBe(5);
  });

  it('handles db failure', async () => {
    helpers.dbRun.mockRejectedValue(new Error('fail'));
    const res = await request(app).delete('/api/projects');
    expect(res.status).toBe(500);
  });
});
