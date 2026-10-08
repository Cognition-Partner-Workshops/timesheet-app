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
  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

const respondWith = (mockFn, ...args) =>
  mockFn.mockImplementation((query, params, callback) => callback(...args));

const expectJson = (response, status, body) => {
  expect(response.status).toBe(status);
  expect(response.body).toEqual(body);
};

describe('Project Routes', () => {
  let mockDb;

  const mockProject = {
    id: 1,
    name: 'Website Redesign',
    description: 'Revamp marketing site',
    client_id: 1,
    start_date: '2024-01-15',
    status: 'active',
    client_name: 'Client A'
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
    test('should return all projects for user', async () => {
      respondWith(mockDb.all, null, [mockProject]);

      const response = await request(app).get('/api/projects');

      expectJson(response, 200, { projects: [mockProject] });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.user_email = ?'),
        ['test@example.com'],
        expect.any(Function)
      );
    });

    test('should filter by client ID and status when provided', async () => {
      respondWith(mockDb.all, null, []);

      const response = await request(app).get('/api/projects?clientId=2&status=on-hold');

      expect(response.status).toBe(200);
      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('AND p.client_id = ?');
      expect(query).toContain('AND p.status = ?');
      expect(params).toEqual(['test@example.com', 2, 'on-hold']);
    });

    test('should return 400 for invalid client ID filter', async () => {
      const response = await request(app).get('/api/projects?clientId=1abc');

      expectJson(response, 400, { error: 'Invalid client ID' });
      expect(mockDb.all).not.toHaveBeenCalled();
      expect(mockDb.get).not.toHaveBeenCalled();
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should return 400 for invalid status filter', async () => {
      const response = await request(app).get('/api/projects?status=archived');

      expectJson(response, 400, { error: 'Invalid project status' });
      expect(mockDb.all).not.toHaveBeenCalled();
    });

    test('should handle database error', async () => {
      respondWith(mockDb.all, new Error('Database error'), null);

      const response = await request(app).get('/api/projects');

      expectJson(response, 500, { error: 'Internal server error' });
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project', async () => {
      respondWith(mockDb.get, null, mockProject);

      const response = await request(app).get('/api/projects/1');

      expectJson(response, 200, { project: mockProject });
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('p.user_email = ?'),
        [1, 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should return 404 if project not found', async () => {
      respondWith(mockDb.get, null, undefined);

      const response = await request(app).get('/api/projects/999');

      expectJson(response, 404, { error: 'Project not found' });
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).get('/api/projects/1.5');

      expectJson(response, 400, { error: 'Invalid project ID' });
      expect(mockDb.all).not.toHaveBeenCalled();
      expect(mockDb.get).not.toHaveBeenCalled();
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should handle database error', async () => {
      respondWith(mockDb.get, new Error('db'), null);

      const response = await request(app).get('/api/projects/1');

      expectJson(response, 500, { error: 'Internal server error' });
    });
  });

  describe('POST /api/projects', () => {
    const newProject = {
      name: 'Website Redesign',
      description: 'Revamp marketing site',
      clientId: 1,
      startDate: '2024-01-15',
      status: 'active'
    };

    test('should create project with valid data', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('FROM clients')) {
          callback(null, { id: 1 });
        } else {
          callback(null, mockProject);
        }
      });
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app).post('/api/projects').send(newProject);

      expectJson(response, 201, {
        message: 'Project created successfully',
        project: mockProject
      });
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        ['Website Redesign', 'Revamp marketing site', 1, '2024-01-15', 'active', 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should default status to active and description to null', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, query.includes('FROM clients') ? { id: 1 } : mockProject));
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Minimal', clientId: 1, startDate: '2024-03-01' });

      expect(response.status).toBe(201);
      expect(mockDb.run.mock.calls[0][1]).toEqual(['Minimal', null, 1, '2024-03-01', 'active', 'test@example.com']);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ ...newProject, status: 'archived' });

      expect(response.status).toBe(400);
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('should return 400 for missing required fields', async () => {
      const response = await request(app).post('/api/projects').send({ name: 'No client' });

      expect(response.status).toBe(400);
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should return 400 if client does not belong to user', async () => {
      respondWith(mockDb.get, null, undefined);

      const response = await request(app).post('/api/projects').send(newProject);

      expectJson(response, 400, { error: 'Client not found or does not belong to user' });
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('FROM clients WHERE id = ? AND user_email = ?'),
        [1, 'test@example.com'],
        expect.any(Function)
      );
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should handle client lookup database error', async () => {
      respondWith(mockDb.get, new Error('db'), null);

      const response = await request(app).post('/api/projects').send(newProject);

      expectJson(response, 500, { error: 'Internal server error' });
    });

    test('should handle insert error', async () => {
      respondWith(mockDb.get, null, { id: 1 });
      respondWith(mockDb.run, new Error('db'));

      const response = await request(app).post('/api/projects').send(newProject);

      expectJson(response, 500, { error: 'Failed to create project' });
    });

    test('should handle retrieval error after insert', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('FROM clients')) {
          callback(null, { id: 1 });
        } else {
          callback(new Error('db'), null);
        }
      });
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app).post('/api/projects').send(newProject);

      expectJson(response, 500, { error: 'Project created but failed to retrieve' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project status', async () => {
      const updated = { ...mockProject, status: 'completed' };
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT id FROM projects')) {
          callback(null, { id: 1 });
        } else {
          callback(null, updated);
        }
      });
      respondWith(mockDb.run, null);

      const response = await request(app).put('/api/projects/1').send({ status: 'completed' });

      expectJson(response, 200, { message: 'Project updated successfully', project: updated });
      const [query, params] = mockDb.run.mock.calls[0];
      expect(query).toContain('status = ?');
      expect(query).toContain('WHERE id = ? AND user_email = ?');
      expect(params).toEqual(['completed', 1, 'test@example.com']);
    });

    test('should update all fields and verify new client ownership', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT id FROM projects')) {
          callback(null, { id: 1 });
        } else if (query.includes('FROM clients WHERE')) {
          callback(null, { id: 2 });
        } else {
          callback(null, mockProject);
        }
      });
      respondWith(mockDb.run, null);

      const response = await request(app).put('/api/projects/1').send({
        name: 'Renamed',
        description: '',
        clientId: 2,
        startDate: '2024-02-01',
        status: 'on-hold'
      });

      expect(response.status).toBe(200);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('FROM clients WHERE id = ? AND user_email = ?'),
        [2, 'test@example.com'],
        expect.any(Function)
      );
      expect(mockDb.run.mock.calls[0][1]).toEqual(
        ['Renamed', null, 2, '2024-02-01', 'on-hold', 1, 'test@example.com']
      );
    });

    test('should return 400 if new client does not belong to user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, query.includes('SELECT id FROM projects') ? { id: 1 } : undefined));

      const response = await request(app).put('/api/projects/1').send({ clientId: 99 });

      expectJson(response, 400, { error: 'Client not found or does not belong to user' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should handle client lookup database error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT id FROM projects')) {
          callback(null, { id: 1 });
        } else {
          callback(new Error('db'), null);
        }
      });

      const response = await request(app).put('/api/projects/1').send({ clientId: 2 });

      expectJson(response, 500, { error: 'Internal server error' });
    });

    test('should return 404 if project not found', async () => {
      respondWith(mockDb.get, null, undefined);

      const response = await request(app).put('/api/projects/999').send({ name: 'X' });

      expectJson(response, 404, { error: 'Project not found' });
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).put('/api/projects/0').send({ name: 'X' });

      expectJson(response, 400, { error: 'Invalid project ID' });
      expect(mockDb.all).not.toHaveBeenCalled();
      expect(mockDb.get).not.toHaveBeenCalled();
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should return 400 for empty update', async () => {
      const response = await request(app).put('/api/projects/1').send({});

      expect(response.status).toBe(400);
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('should handle lookup database error', async () => {
      respondWith(mockDb.get, new Error('db'), null);

      const response = await request(app).put('/api/projects/1').send({ name: 'X' });

      expectJson(response, 500, { error: 'Internal server error' });
    });

    test('should handle update error', async () => {
      respondWith(mockDb.get, null, { id: 1 });
      respondWith(mockDb.run, new Error('db'));

      const response = await request(app).put('/api/projects/1').send({ name: 'X' });

      expectJson(response, 500, { error: 'Failed to update project' });
    });

    test('should handle retrieval error after update', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT id FROM projects')) {
          callback(null, { id: 1 });
        } else {
          callback(new Error('db'), null);
        }
      });
      respondWith(mockDb.run, null);

      const response = await request(app).put('/api/projects/1').send({ name: 'X' });

      expectJson(response, 500, { error: 'Project updated but failed to retrieve' });
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project', async () => {
      respondWith(mockDb.get, null, { id: 1 });
      respondWith(mockDb.run, null);

      const response = await request(app).delete('/api/projects/1');

      expectJson(response, 200, { message: 'Project deleted successfully' });
      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM projects WHERE id = ? AND user_email = ?',
        [1, 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should return 404 if project not found', async () => {
      respondWith(mockDb.get, null, undefined);

      const response = await request(app).delete('/api/projects/999');

      expectJson(response, 404, { error: 'Project not found' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).delete('/api/projects/1garbage');

      expectJson(response, 400, { error: 'Invalid project ID' });
      expect(mockDb.all).not.toHaveBeenCalled();
      expect(mockDb.get).not.toHaveBeenCalled();
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should handle lookup database error', async () => {
      respondWith(mockDb.get, new Error('db'), null);

      const response = await request(app).delete('/api/projects/1');

      expectJson(response, 500, { error: 'Internal server error' });
    });

    test('should handle delete error', async () => {
      respondWith(mockDb.get, null, { id: 1 });
      respondWith(mockDb.run, new Error('db'));

      const response = await request(app).delete('/api/projects/1');

      expectJson(response, 500, { error: 'Failed to delete project' });
    });
  });
});
