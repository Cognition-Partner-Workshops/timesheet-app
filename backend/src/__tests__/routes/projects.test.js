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
      const mockProjects = [
        { id: 1, name: 'Project A', client_id: 1, client_name: 'Client A', start_date: '2024-01-01', status: 'active' },
        { id: 2, name: 'Project B', client_id: 1, client_name: 'Client A', start_date: '2024-02-01', status: 'completed' }
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

    test('should filter projects by clientId', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/projects?clientId=5');

      expect(response.status).toBe(200);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND p.client_id = ?'),
        ['test@example.com', 5],
        expect.any(Function)
      );
    });

    test('should filter projects by status', async () => {
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
    });

    test('should return 400 for invalid status filter', async () => {
      const response = await request(app).get('/api/projects?status=invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid status' });
    });

    test('should return empty array when no projects exist', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: [] });
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
      const mockProject = { id: 1, name: 'Project A', client_id: 1, client_name: 'Client A', status: 'active' };

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
        callback(null, null);
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
    const validProject = {
      name: 'New Project',
      description: 'Project description',
      clientId: 1,
      startDate: '2024-01-15'
    };

    test('should create new project with valid data and default status', async () => {
      const createdProject = { id: 1, ...validProject, status: 'active', client_name: 'Client A' };

      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('FROM clients')) {
          callback(null, { id: 1 });
        } else {
          callback(null, createdProject);
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send(validProject);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.project).toEqual(createdProject);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        ['New Project', 'Project description', 1, 'test@example.com', '2024-01-15', 'active'],
        expect.any(Function)
      );
    });

    test('should create project with explicit status', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('FROM clients')) {
          callback(null, { id: 1 });
        } else {
          callback(null, { id: 1, status: 'on-hold' });
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ ...validProject, status: 'on-hold' });

      expect(response.status).toBe(201);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        ['New Project', 'Project description', 1, 'test@example.com', '2024-01-15', 'on-hold'],
        expect.any(Function)
      );
    });

    test('should verify client belongs to user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      await request(app)
        .post('/api/projects')
        .send(validProject);

      expect(mockDb.get).toHaveBeenCalledWith(
        'SELECT id FROM clients WHERE id = ? AND user_email = ?',
        [1, 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should return 400 when client not found or not owned', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send(validProject);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ clientId: 1, startDate: '2024-01-15' });

      expect(response.status).toBe(400);
    });

    test('should return 400 for missing clientId', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Project', startDate: '2024-01-15' });

      expect(response.status).toBe(400);
    });

    test('should return 400 for missing startDate', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Project', clientId: 1 });

      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ ...validProject, status: 'invalid' });

      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid startDate', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ ...validProject, startDate: 'not-a-date' });

      expect(response.status).toBe(400);
    });

    test('should handle database insert error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Insert failed'));
      });

      const response = await request(app)
        .post('/api/projects')
        .send(validProject);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create project' });
    });

    test('should handle error retrieving project after creation', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('FROM clients')) {
          callback(null, { id: 1 });
        } else {
          callback(new Error('Retrieval failed'), null);
        }
      });

      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send(validProject);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project created but failed to retrieve' });
    });

    test('should handle database error when checking client', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send(validProject);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project name', async () => {
      const updatedProject = { id: 1, name: 'Updated Name', status: 'active' };

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 }); // Project exists
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, updatedProject);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project updated successfully');
      expect(response.body.project).toEqual(updatedProject);
    });

    test('should build correct SET clause for partial update', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'New Name', status: 'completed' });

      expect(response.status).toBe(200);
      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE projects SET name = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?',
        ['New Name', 'completed', 1, 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should verify new client belongs to user when clientId updated', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { id: 1 }); // Project exists
        })
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { id: 2 }); // Client exists
        })
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { id: 1, client_id: 2 });
        });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ clientId: 2 });

      expect(response.status).toBe(200);
      expect(mockDb.get).toHaveBeenCalledWith(
        'SELECT id FROM clients WHERE id = ? AND user_email = ?',
        [2, 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should return 400 when updated clientId does not belong to user', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { id: 1 }); // Project exists
        })
        .mockImplementationOnce((query, params, callback) => {
          callback(null, null); // Client not found
        });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ clientId: 999 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .put('/api/projects/999')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app)
        .put('/api/projects/invalid')
        .send({ name: 'Updated' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
    });

    test('should return 400 for empty update', async () => {
      const response = await request(app)
        .put('/api/projects/1')
        .send({});

      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app)
        .put('/api/projects/1')
        .send({ status: 'bogus' });

      expect(response.status).toBe(400);
    });

    test('should handle database error when checking project existence', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error during update', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Update failed'));
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update project' });
    });

    test('should handle error retrieving project after update', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 1 });
      });

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(new Error('Retrieval failed'), null);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated' });

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
        callback(null, null);
      });

      const response = await request(app).delete('/api/projects/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('should return 400 for invalid project ID', async () => {
      const response = await request(app).delete('/api/projects/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
    });

    test('should handle database delete error', async () => {
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

    test('should handle database error when checking project existence', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });
});
