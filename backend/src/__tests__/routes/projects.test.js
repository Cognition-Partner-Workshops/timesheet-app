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

const validProject = {
  name: 'Website Redesign',
  description: 'Revamp marketing site',
  clientId: 1,
  startDate: '2024-01-15',
  status: 'active'
};

describe('Project Routes', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error.mockRestore();
  });

  describe('GET /api/projects', () => {
    test('should return all projects for authenticated user', async () => {
      const mockProjects = [
        { id: 1, name: 'Project A', client_id: 1, client_name: 'Client A', start_date: '2024-01-01', status: 'active' },
        { id: 2, name: 'Project B', client_id: 2, client_name: 'Client B', start_date: '2024-02-01', status: 'completed' }
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockProjects);
      });

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: mockProjects });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.user_email = ?'),
        ['test@example.com'],
        expect.any(Function)
      );
    });

    test('should filter by clientId and status', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/projects?clientId=3&status=on-hold');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: [] });
      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('AND p.client_id = ?');
      expect(query).toContain('AND p.status = ?');
      expect(params).toEqual(['test@example.com', 3, 'on-hold']);
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
    test('should return specific project', async () => {
      const mockProject = { id: 1, name: 'Project A', client_name: 'Client A' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockProject);
      });

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ project: mockProject });
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
      const createdProject = { id: 7, name: 'Website Redesign', client_id: 1, client_name: 'Client A', start_date: '2024-01-15', status: 'active' };

      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('FROM clients WHERE')) {
          callback(null, { id: 1 });
        } else {
          callback(null, createdProject);
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ lastID: 7 }, null);
      });

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ message: 'Project created successfully', project: createdProject });
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        ['Website Redesign', 'Revamp marketing site', 1, 'test@example.com', '2024-01-15', 'active'],
        expect.any(Function)
      );
      expect(mockDb.get).toHaveBeenLastCalledWith(
        expect.any(String),
        [7, 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should default status to active and description to null', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Minimal', clientId: 1, startDate: '2024-03-01' });

      expect(response.status).toBe(201);
      expect(mockDb.run.mock.calls[0][1]).toEqual(['Minimal', null, 1, 'test@example.com', '2024-03-01', 'active']);
    });

    test('should return 400 if client not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, undefined);
      });

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('FROM clients WHERE id = ? AND user_email = ?'),
        [1, 'test@example.com'],
        expect.any(Function)
      );
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test.each([
      ['missing name', { ...validProject, name: undefined }],
      ['empty name', { ...validProject, name: '   ' }],
      ['missing clientId', { ...validProject, clientId: undefined }],
      ['missing startDate', { ...validProject, startDate: undefined }],
      ['invalid startDate', { ...validProject, startDate: 'not-a-date' }],
      ['invalid status', { ...validProject, status: 'archived' }]
    ])('should return 400 for %s', async (_label, body) => {
      const response = await request(app).post('/api/projects').send(body);

      expect(response.status).toBe(400);
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('should handle database error on client lookup', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'));
      });

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error on insert', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Insert failed'));
      });

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create project' });
    });

    test('should handle database error on retrieval after insert', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('FROM clients WHERE')) {
          callback(null, { id: 1 });
        } else {
          callback(new Error('Retrieve failed'));
        }
      });
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
      const updated = { id: 1, name: 'Project A', status: 'completed', client_name: 'Client A' };
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('FROM projects p')) {
          callback(null, updated);
        } else {
          callback(null, { id: 1 });
        }
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app).put('/api/projects/1').send({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Project updated successfully', project: updated });
      const [query, params] = mockDb.run.mock.calls[0];
      expect(query).toBe('UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?');
      expect(params).toEqual(['completed', 1, 'test@example.com']);
    });

    test('should update all fields and verify new client ownership', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Renamed', description: '', clientId: 2, startDate: '2024-05-01', status: 'on-hold' });

      expect(response.status).toBe(200);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('FROM clients WHERE id = ? AND user_email = ?'),
        [2, 'test@example.com'],
        expect.any(Function)
      );
      const [query, params] = mockDb.run.mock.calls[0];
      expect(query).toContain('name = ?, description = ?, client_id = ?, start_date = ?, status = ?');
      expect(params).toEqual(['Renamed', null, 2, '2024-05-01', 'on-hold', 1, 'test@example.com']);
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, undefined);
      });

      const response = await request(app).put('/api/projects/999').send({ name: 'X' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('should return 400 if new client not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('FROM projects')) {
          callback(null, { id: 1 });
        } else {
          callback(null, undefined);
        }
      });

      const response = await request(app).put('/api/projects/1').send({ clientId: 999 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).put('/api/projects/invalid').send({ name: 'X' });

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

    test('should handle database error on lookup', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'));
      });

      const response = await request(app).put('/api/projects/1').send({ name: 'X' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error on client lookup', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('FROM projects')) {
          callback(null, { id: 1 });
        } else {
          callback(new Error('Database error'));
        }
      });

      const response = await request(app).put('/api/projects/1').send({ clientId: 2 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error on update', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Update failed'));
      });

      const response = await request(app).put('/api/projects/1').send({ name: 'X' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update project' });
    });

    test('should handle database error on retrieval after update', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('FROM projects p')) {
          callback(new Error('Retrieve failed'));
        } else {
          callback(null, { id: 1 });
        }
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app).put('/api/projects/1').send({ name: 'X' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project updated but failed to retrieve' });
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete existing project', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

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
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, undefined);
      });

      const response = await request(app).delete('/api/projects/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).delete('/api/projects/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
    });

    test('should handle database error on lookup', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'));
      });

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error on delete', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Delete failed'));
      });

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete project' });
    });
  });
});
