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
    test('returns projects scoped to the authenticated user', async () => {
      const projects = [{ id: 1, name: 'Website', client_id: 2, client_name: 'Client A' }];
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, projects);
      });

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.user_email = ?'),
        ['test@example.com'],
        expect.any(Function)
      );
      expect(mockDb.all.mock.calls[0][0]).toContain('LEFT JOIN clients');
      expect(mockDb.all.mock.calls[0][0]).toContain('ORDER BY p.name');
    });

    test('filters by client and status using parameterized values', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/projects?clientId=3&status=completed');

      expect(response.status).toBe(200);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND p.client_id = ? AND p.status = ?'),
        ['test@example.com', 3, 'completed'],
        expect.any(Function)
      );
    });

    test.each([
      ['/api/projects?clientId=invalid', { error: 'Invalid client ID' }],
      ['/api/projects?clientId=0', { error: 'Invalid client ID' }],
      ['/api/projects?status=paused', { error: 'Invalid project status' }]
    ])('rejects invalid filters at %s', async (path, body) => {
      const response = await request(app).get(path);

      expect(response.status).toBe(400);
      expect(response.body).toEqual(body);
      expect(mockDb.all).not.toHaveBeenCalled();
    });

    test('returns 500 when the database query fails', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/projects/:id', () => {
    test('returns a project scoped to the authenticated user', async () => {
      const project = { id: 1, name: 'Website', client_id: 2, client_name: 'Client A' };
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, project);
      });

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ project });
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.id = ? AND p.user_email = ?'),
        [1, 'test@example.com'],
        expect.any(Function)
      );
    });

    test('returns 400 for an invalid project ID', async () => {
      const response = await request(app).get('/api/projects/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('returns 404 when the project is not owned by the user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).get('/api/projects/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('returns 500 when the database query fails', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    test('creates a project for a client owned by the authenticated user', async () => {
      const project = {
        id: 1,
        name: 'Website',
        description: null,
        client_id: 2,
        client_name: 'Client A',
        start_date: '2024-01-15',
        status: 'active'
      };
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('FROM clients')) {
          callback(null, { id: 2 });
        } else {
          callback(null, project);
        }
      });
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Website', clientId: 2, startDate: '2024-01-15' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ message: 'Project created successfully', project });
      expect(mockDb.get.mock.calls[0][1]).toEqual([2, 'test@example.com']);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        ['Website', null, 2, '2024-01-15', 'active', 'test@example.com'],
        expect.any(Function)
      );
      expect(mockDb.get.mock.calls[1][1]).toEqual([1, 'test@example.com']);
    });

    test('returns 400 if the client is not owned by the user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Website', clientId: 2, startDate: '2024-01-15' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ? AND user_email = ?'),
        [2, 'test@example.com'],
        expect.any(Function)
      );
    });

    test.each([
      [{ clientId: 1, startDate: '2024-01-15' }, 'missing name'],
      [{ name: 'Website', clientId: 1, startDate: '2024-01-15', status: 'paused' }, 'bad status'],
      [{ name: 'Website', clientId: 1, startDate: 'not-a-date' }, 'bad date'],
      [{ name: 'Website', startDate: '2024-01-15' }, 'missing clientId']
    ])('returns 400 for %s', async (body) => {
      const response = await request(app).post('/api/projects').send(body);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('returns 500 when the client lookup fails', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Website', clientId: 2, startDate: '2024-01-15' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('updates a project scoped to the authenticated user', async () => {
      const project = { id: 1, name: 'New name', client_id: 2, client_name: 'Client A', status: 'completed' };
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('FROM projects WHERE')) {
          callback(null, { id: 1 });
        } else {
          callback(null, project);
        }
      });
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app)
        .put('/api/projects/1')
        .send({ name: 'New name', status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Project updated successfully', project });
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE projects SET name = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?'),
        ['New name', 'completed', 1, 'test@example.com'],
        expect.any(Function)
      );
      expect(mockDb.get.mock.calls[0][1]).toEqual([1, 'test@example.com']);
      expect(mockDb.get.mock.calls[1][1]).toEqual([1, 'test@example.com']);
    });

    test('returns 400 for an invalid project ID', async () => {
      const response = await request(app).put('/api/projects/nope').send({ name: 'Updated' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('returns 400 for invalid project update data', async () => {
      const response = await request(app).put('/api/projects/1').send({ status: 'paused' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('returns 404 when the project is not owned by the user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));

      const response = await request(app).put('/api/projects/999').send({ name: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('returns 400 if an updated client is not owned by the user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('FROM projects WHERE')) {
          callback(null, { id: 1 });
        } else {
          callback(null, null);
        }
      });

      const response = await request(app).put('/api/projects/1').send({ clientId: 7 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
      expect(mockDb.get.mock.calls[1][1]).toEqual([7, 'test@example.com']);
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('returns 500 when the project lookup fails', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('deletes a project scoped to the authenticated user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Project deleted successfully' });
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ? AND user_email = ?'),
        [1, 'test@example.com'],
        expect.any(Function)
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM projects WHERE id = ? AND user_email = ?'),
        [1, 'test@example.com'],
        expect.any(Function)
      );
    });

    test('returns 400 for an invalid project ID', async () => {
      const response = await request(app).delete('/api/projects/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('returns 404 when the project is not owned by the user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, null));

      const response = await request(app).delete('/api/projects/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('returns 500 when the project lookup fails', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
    });
  });
});
