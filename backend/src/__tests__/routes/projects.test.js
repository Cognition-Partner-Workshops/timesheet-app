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

  const mockProject = {
    id: 1,
    name: 'Website Redesign',
    description: 'Redesign marketing site',
    client_id: 1,
    start_date: '2024-01-15',
    status: 'active',
    client_name: 'Client A',
    created_at: '2024-01-01',
    updated_at: '2024-01-01'
  };

  const validProject = {
    name: 'Website Redesign',
    description: 'Redesign marketing site',
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
        callback(null, [mockProject]);
      });

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: [mockProject] });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.user_email = ?'),
        ['test@example.com'],
        expect.any(Function)
      );
    });

    test('should return empty array when no projects exist', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects: [] });
    });

    test('should filter by clientId and status', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [mockProject]);
      });

      const response = await request(app).get('/api/projects?clientId=1&status=active');

      expect(response.status).toBe(200);
      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('AND p.client_id = ?');
      expect(query).toContain('AND p.status = ?');
      expect(params).toEqual(['test@example.com', 1, 'active']);
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
    test('should create new project with valid data', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { id: 1 }); // Client exists
        })
        .mockImplementationOnce((query, params, callback) => {
          callback(null, mockProject); // Created project
        });

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send(validProject);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.project).toEqual(mockProject);
      expect(mockDb.get.mock.calls[0][1]).toEqual([1, 'test@example.com']);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        ['Website Redesign', 'Redesign marketing site', 1, '2024-01-15', 'active', 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should default status to active and description to null', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, mockProject));

      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Minimal', clientId: 1, startDate: '2024-03-01' });

      expect(response.status).toBe(201);
      expect(mockDb.run.mock.calls[0][1]).toEqual(['Minimal', null, 1, '2024-03-01', 'active', 'test@example.com']);
    });

    test('should return 400 if client not found or not owned by user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ ...validProject, clientId: 999 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should return 400 for missing name', async () => {
      const { name, ...rest } = validProject;
      const response = await request(app).post('/api/projects').send(rest);

      expect(response.status).toBe(400);
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('should return 400 for missing clientId', async () => {
      const { clientId, ...rest } = validProject;
      const response = await request(app).post('/api/projects').send(rest);

      expect(response.status).toBe(400);
    });

    test('should return 400 for missing startDate', async () => {
      const { startDate, ...rest } = validProject;
      const response = await request(app).post('/api/projects').send(rest);

      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid startDate', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ ...validProject, startDate: 'not-a-date' });

      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ ...validProject, status: 'archived' });

      expect(response.status).toBe(400);
    });

    test('should handle database error when checking client', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
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
        callback(new Error('Database error'));
      });

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create project' });
    });

    test('should handle database error when retrieving created project', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(new Error('Database error'), null));
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project created but failed to retrieve' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project fields', async () => {
      const updatedProject = { ...mockProject, name: 'Updated', status: 'on-hold' };

      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 })) // Project exists
        .mockImplementationOnce((query, params, callback) => callback(null, updatedProject));

      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'Updated', status: 'on-hold' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project updated successfully');
      expect(response.body.project).toEqual(updatedProject);

      const [query, params] = mockDb.run.mock.calls[0];
      expect(query).toContain('name = ?');
      expect(query).toContain('status = ?');
      expect(query).toContain('WHERE id = ? AND user_email = ?');
      expect(params).toEqual(['Updated', 'on-hold', 1, 'test@example.com']);
    });

    test('should update description to null when empty string provided', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, mockProject));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app)
        .put('/api/projects/1')
        .send({ description: '' });

      expect(response.status).toBe(200);
      expect(mockDb.run.mock.calls[0][1]).toEqual([null, 1, 'test@example.com']);
    });

    test('should update clientId and startDate after verifying client ownership', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 })) // Project exists
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 2 })) // Client exists
        .mockImplementationOnce((query, params, callback) => callback(null, mockProject));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app)
        .put('/api/projects/1')
        .send({ clientId: 2, startDate: '2024-02-01' });

      expect(response.status).toBe(200);
      expect(mockDb.get.mock.calls[1][0]).toContain('FROM clients WHERE id = ? AND user_email = ?');
      expect(mockDb.get.mock.calls[1][1]).toEqual([2, 'test@example.com']);
      expect(mockDb.run.mock.calls[0][1]).toEqual([2, '2024-02-01', 1, 'test@example.com']);
    });

    test('should return 400 if new client not found', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, null));

      const response = await request(app)
        .put('/api/projects/1')
        .send({ clientId: 999 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should handle database error when verifying new client', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(new Error('Database error'), null));

      const response = await request(app)
        .put('/api/projects/1')
        .send({ clientId: 2 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should return 404 if project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));

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

    test('should return 400 for empty body', async () => {
      const response = await request(app).put('/api/projects/1').send({});

      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app)
        .put('/api/projects/1')
        .send({ status: 'done' });

      expect(response.status).toBe(400);
    });

    test('should handle database error when checking project', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error on update', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('Database error')));

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update project' });
    });

    test('should handle database error when retrieving updated project', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(new Error('Database error'), null));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project updated but failed to retrieve' });
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project', async () => {
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
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));

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

    test('should handle database error when checking project', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(new Error('Database error'), null));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error on delete', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('Database error')));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete project' });
    });
  });
});
