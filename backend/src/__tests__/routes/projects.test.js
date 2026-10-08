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
// Add error handler for Joi validation
app.use((err, req, res, next) => {
  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

describe('Project Routes', () => {
  let mockDb;

  const sampleProject = {
    id: 1,
    name: 'Website Redesign',
    description: 'Revamp marketing site',
    client_id: 1,
    start_date: '2024-01-15',
    status: 'active',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    client_name: 'Client A'
  };

  const validProject = {
    name: 'Website Redesign',
    description: 'Revamp marketing site',
    clientId: 1,
    startDate: '2024-01-15',
    status: 'active'
  };

  beforeEach(() => {
    mockDb = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/projects', () => {
    test('should return all projects for authenticated user', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [sampleProject]);
      });

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: [sampleProject] });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.user_email = ?'),
        ['test@example.com'],
        expect.any(Function)
      );
    });

    test('should filter by clientId', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [sampleProject]);
      });

      const response = await request(app).get('/api/projects?clientId=1');

      expect(response.status).toBe(200);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND p.client_id = ?'),
        ['test@example.com', 1],
        expect.any(Function)
      );
    });

    test('should filter by status', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/projects?status=on-hold');

      expect(response.status).toBe(200);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND p.status = ?'),
        ['test@example.com', 'on-hold'],
        expect.any(Function)
      );
    });

    test('should return 400 for invalid clientId filter', async () => {
      const response = await request(app).get('/api/projects?clientId=abc');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
      expect(mockDb.all).not.toHaveBeenCalled();
    });

    test('should return 400 for invalid status filter', async () => {
      const response = await request(app).get('/api/projects?status=archived');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project status' });
      expect(mockDb.all).not.toHaveBeenCalled();
    });

    test('should handle database error', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project scoped to user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, sampleProject);
      });

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ project: sampleProject });
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.id = ? AND p.user_email = ?'),
        [1, 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, undefined);
      });

      const response = await request(app).get('/api/projects/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).get('/api/projects/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
    });

    test('should handle database error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/projects', () => {
    test('should create new project with valid data', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, sampleProject));

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: 'Project created successfully',
        project: sampleProject
      });
      expect(mockDb.get).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('FROM clients WHERE id = ? AND user_email = ?'),
        [1, 'test@example.com'],
        expect.any(Function)
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        ['Website Redesign', 'Revamp marketing site', 1, 'test@example.com', '2024-01-15', 'active'],
        expect.any(Function)
      );
    });

    test('should default status to active and description to null', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, sampleProject));

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Minimal', clientId: 1, startDate: '2024-02-01' });

      expect(response.status).toBe(201);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        ['Minimal', null, 1, 'test@example.com', '2024-02-01', 'active'],
        expect.any(Function)
      );
    });

    test.each([
      ['missing name', { clientId: 1, startDate: '2024-01-15' }],
      ['empty name', { name: '', clientId: 1, startDate: '2024-01-15' }],
      ['missing clientId', { name: 'P', startDate: '2024-01-15' }],
      ['missing startDate', { name: 'P', clientId: 1 }],
      ['invalid startDate', { name: 'P', clientId: 1, startDate: 'not-a-date' }],
      ['invalid status', { name: 'P', clientId: 1, startDate: '2024-01-15', status: 'archived' }]
    ])('should return 400 for %s', async (_label, body) => {
      const response = await request(app).post('/api/projects').send(body);

      expect(response.status).toBe(400);
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should return 400 if client does not belong to user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, undefined));

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should handle database error when verifying client', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(new Error('DB error')));

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database insert error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('Insert failed')));

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create project' });
    });

    test('should handle error retrieving project after creation', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(new Error('Retrieval failed')));

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project created but failed to retrieve' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project status', async () => {
      const updated = { ...sampleProject, status: 'completed' };

      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, updated));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app).put('/api/projects/1').send({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Project updated successfully', project: updated });
      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?',
        ['completed', 1, 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should update all fields and verify new client', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 2 }))
        .mockImplementationOnce((query, params, callback) => callback(null, sampleProject));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app).put('/api/projects/1').send({
        name: 'Renamed',
        description: '',
        clientId: 2,
        startDate: '2024-03-01',
        status: 'on-hold'
      });

      expect(response.status).toBe(200);
      expect(mockDb.get).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('FROM clients WHERE id = ? AND user_email = ?'),
        [2, 'test@example.com'],
        expect.any(Function)
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE projects SET name = ?, description = ?, client_id = ?, start_date = ?, status = ?'),
        ['Renamed', null, 2, '2024-03-01', 'on-hold', 1, 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should return 400 if new client does not belong to user', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, undefined));

      const response = await request(app).put('/api/projects/1').send({ clientId: 99 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should handle database error when verifying new client', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(new Error('DB error')));

      const response = await request(app).put('/api/projects/1').send({ clientId: 2 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, undefined));

      const response = await request(app).put('/api/projects/999').send({ name: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).put('/api/projects/invalid').send({ name: 'Updated' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
    });

    test('should return 400 for empty update', async () => {
      const response = await request(app).put('/api/projects/1').send({});

      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app).put('/api/projects/1').send({ status: 'done' });

      expect(response.status).toBe(400);
    });

    test('should handle database error when checking project existence', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(new Error('DB error')));

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error during update', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('Update failed')));

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update project' });
    });

    test('should handle error retrieving project after update', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(new Error('Retrieval failed')));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project updated but failed to retrieve' });
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete existing project', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Project deleted successfully' });
      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM projects WHERE id = ? AND user_email = ?',
        [1, 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, undefined));

      const response = await request(app).delete('/api/projects/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).delete('/api/projects/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
    });

    test('should handle database error when checking project existence', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(new Error('DB error')));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database delete error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('Delete failed')));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete project' });
    });
  });
});
