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

const SAMPLE_PROJECT = {
  id: 1, name: 'Project A', description: 'Desc A',
  client_id: 1, start_date: '2024-01-01', status: 'active', client_name: 'Client A'
};

const VALID_INPUT = {
  name: 'New Project', description: 'Project description',
  clientId: 1, startDate: '2024-01-15', status: 'active'
};

function createMockDb() {
  return { all: jest.fn(), get: jest.fn(), run: jest.fn() };
}

function mockGetReturns(mockDb, row) {
  mockDb.get.mockImplementation((q, p, cb) => cb(null, row));
}

function mockGetReturnsOnce(mockDb, row) {
  mockDb.get.mockImplementationOnce((q, p, cb) => cb(null, row));
}

function mockGetFails(mockDb) {
  mockDb.get.mockImplementation((q, p, cb) => cb(new Error('Database error'), null));
}

function mockRunSucceeds(mockDb, lastID) {
  if (lastID !== undefined) {
    mockDb.run.mockImplementation(function(q, p, cb) {
      this.lastID = lastID;
      cb.call(this, null);
    });
  } else {
    mockDb.run.mockImplementation((q, p, cb) => cb(null));
  }
}

function mockRunFails(mockDb, msg = 'Operation failed') {
  mockDb.run.mockImplementation((q, p, cb) => cb(new Error(msg)));
}

describe('Project Routes', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => jest.clearAllMocks());

  describe('GET /api/projects', () => {
    test('returns all projects for authenticated user', async () => {
      const projects = [SAMPLE_PROJECT, { ...SAMPLE_PROJECT, id: 2, name: 'Project B', status: 'completed' }];
      mockDb.all.mockImplementation((q, p, cb) => cb(null, projects));

      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects });
    });

    test('returns empty array when none exist', async () => {
      mockDb.all.mockImplementation((q, p, cb) => cb(null, []));
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: [] });
    });

    test('handles database error', async () => {
      mockDb.all.mockImplementation((q, p, cb) => cb(new Error('fail'), null));
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('returns specific project', async () => {
      mockGetReturns(mockDb, SAMPLE_PROJECT);
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ project: SAMPLE_PROJECT });
    });

    test('returns 404 if not found', async () => {
      mockGetReturns(mockDb, null);
      const res = await request(app).get('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).get('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('handles database error', async () => {
      mockGetFails(mockDb);
      const res = await request(app).get('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    test('creates project with valid data', async () => {
      mockGetReturnsOnce(mockDb, { id: 1 }); // client exists
      mockRunSucceeds(mockDb, 1);
      mockGetReturnsOnce(mockDb, SAMPLE_PROJECT); // retrieve created

      const res = await request(app).post('/api/projects').send(VALID_INPUT);
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
      expect(res.body.project).toEqual(SAMPLE_PROJECT);
    });

    test('creates project without description', async () => {
      const { description, ...input } = VALID_INPUT;
      mockGetReturnsOnce(mockDb, { id: 1 });
      mockRunSucceeds(mockDb, 1);
      mockGetReturnsOnce(mockDb, { ...SAMPLE_PROJECT, description: null });

      const res = await request(app).post('/api/projects').send(input);
      expect(res.status).toBe(201);
    });

    test.each([
      [{ clientId: 1, startDate: '2024-01-15', status: 'active' }, 'missing name'],
      [{ name: 'T', startDate: '2024-01-15', status: 'active' }, 'missing clientId'],
      [{ name: 'T', clientId: 1, status: 'active' }, 'missing startDate'],
      [{ name: 'T', clientId: 1, startDate: '2024-01-15' }, 'missing status'],
      [{ name: 'T', clientId: 1, startDate: '2024-01-15', status: 'invalid' }, 'invalid status'],
    ])('returns 400 for %s', async (body) => {
      const res = await request(app).post('/api/projects').send(body);
      expect(res.status).toBe(400);
    });

    test('returns 400 if client does not belong to user', async () => {
      mockGetReturns(mockDb, null);
      const res = await request(app).post('/api/projects').send(VALID_INPUT);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Client not found or does not belong to user');
    });

    test('handles insert error', async () => {
      mockGetReturnsOnce(mockDb, { id: 1 });
      mockRunFails(mockDb);
      const res = await request(app).post('/api/projects').send(VALID_INPUT);
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create project');
    });

    test('handles retrieval error after creation', async () => {
      mockGetReturnsOnce(mockDb, { id: 1 });
      mockRunSucceeds(mockDb, 1);
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(new Error('fail'), null));

      const res = await request(app).post('/api/projects').send(VALID_INPUT);
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Project created but failed to retrieve');
    });

    test('handles database error when verifying client', async () => {
      mockGetFails(mockDb);
      const res = await request(app).post('/api/projects').send(VALID_INPUT);
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('updates project name', async () => {
      const updated = { ...SAMPLE_PROJECT, name: 'Updated' };
      mockGetReturnsOnce(mockDb, { id: 1 });
      mockRunSucceeds(mockDb);
      mockGetReturnsOnce(mockDb, updated);

      const res = await request(app).put('/api/projects/1').send({ name: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project updated successfully');
    });

    test('updates project status', async () => {
      mockGetReturnsOnce(mockDb, { id: 1 });
      mockRunSucceeds(mockDb);
      mockGetReturnsOnce(mockDb, { ...SAMPLE_PROJECT, status: 'completed' });

      const res = await request(app).put('/api/projects/1').send({ status: 'completed' });
      expect(res.status).toBe(200);
    });

    test('updates clientId with ownership verification', async () => {
      mockGetReturnsOnce(mockDb, { id: 1 }); // project exists
      mockGetReturnsOnce(mockDb, { id: 2 }); // new client valid
      mockRunSucceeds(mockDb);
      mockGetReturnsOnce(mockDb, { ...SAMPLE_PROJECT, client_id: 2 });

      const res = await request(app).put('/api/projects/1').send({ clientId: 2 });
      expect(res.status).toBe(200);
    });

    test('returns 400 if new client does not belong to user', async () => {
      mockGetReturnsOnce(mockDb, { id: 1 });
      mockGetReturnsOnce(mockDb, null);

      const res = await request(app).put('/api/projects/1').send({ clientId: 999 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Client not found or does not belong to user');
    });

    test('returns 404 if project not found', async () => {
      mockGetReturns(mockDb, null);
      const res = await request(app).put('/api/projects/999').send({ name: 'X' });
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).put('/api/projects/invalid').send({ name: 'X' });
      expect(res.status).toBe(400);
    });

    test('returns 400 for empty update', async () => {
      const res = await request(app).put('/api/projects/1').send({});
      expect(res.status).toBe(400);
    });

    test('returns 400 for invalid status', async () => {
      const res = await request(app).put('/api/projects/1').send({ status: 'bad' });
      expect(res.status).toBe(400);
    });

    test('handles db error checking existence', async () => {
      mockGetFails(mockDb);
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
    });

    test('handles update error', async () => {
      mockGetReturnsOnce(mockDb, { id: 1 });
      mockRunFails(mockDb);
      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update project');
    });

    test('handles retrieval error after update', async () => {
      mockGetReturnsOnce(mockDb, { id: 1 });
      mockRunSucceeds(mockDb);
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(new Error('fail'), null));

      const res = await request(app).put('/api/projects/1').send({ name: 'X' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Project updated but failed to retrieve');
    });

    test('handles db error verifying new client', async () => {
      mockGetReturnsOnce(mockDb, { id: 1 });
      mockDb.get.mockImplementationOnce((q, p, cb) => cb(new Error('fail'), null));

      const res = await request(app).put('/api/projects/1').send({ clientId: 2 });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('deletes existing project', async () => {
      mockGetReturns(mockDb, { id: 1 });
      mockRunSucceeds(mockDb);
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project deleted successfully');
    });

    test('returns 404 if not found', async () => {
      mockGetReturns(mockDb, null);
      const res = await request(app).delete('/api/projects/999');
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid ID', async () => {
      const res = await request(app).delete('/api/projects/invalid');
      expect(res.status).toBe(400);
    });

    test('handles delete error', async () => {
      mockGetReturns(mockDb, { id: 1 });
      mockRunFails(mockDb);
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete project');
    });

    test('handles db error checking existence', async () => {
      mockGetFails(mockDb);
      const res = await request(app).delete('/api/projects/1');
      expect(res.status).toBe(500);
    });
  });
});
