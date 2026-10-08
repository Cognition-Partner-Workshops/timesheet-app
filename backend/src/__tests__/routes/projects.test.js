const request = require('supertest');
const express = require('express');
const projectRoutes = require('../../routes/projects');
const { getDatabase } = require('../../database/init');
const { errorHandler } = require('../../middleware/errorHandler');
const { projectSchema, updateProjectSchema } = require('../../validation/schemas');

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
app.use(errorHandler);

describe('Project Routes', () => {
  let mockDb;
  let consoleErrorSpy;

  beforeEach(() => {
    mockDb = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    for (const method of ['all', 'get', 'run']) {
      for (const [query, params] of mockDb[method].mock.calls) {
        expect(Array.isArray(params)).toBe(true);
        expect(params).toContain('test@example.com');
        expect(query).toContain('user_email');
      }
    }
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('GET /api/projects', () => {
    test('lists all projects for the authenticated user', async () => {
      const projects = [{ id: 1, name: 'Website' }];
      mockDb.all.mockImplementation((query, params, callback) => callback(null, projects));

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ projects });
      expect(mockDb.all.mock.calls[0][0]).toContain('WHERE p.user_email = ?');
      expect(mockDb.all.mock.calls[0][0]).toContain('ORDER BY p.name');
      expect(mockDb.all.mock.calls[0][1]).toEqual(['test@example.com']);
    });

    test('filters by client ID', async () => {
      mockDb.all.mockImplementation((query, params, callback) => callback(null, []));

      const response = await request(app).get('/api/projects?clientId=4');

      expect(response.status).toBe(200);
      expect(mockDb.all.mock.calls[0][0]).toContain('p.client_id = ?');
      expect(mockDb.all.mock.calls[0][1]).toEqual(['test@example.com', 4]);
    });

    test('filters by status', async () => {
      mockDb.all.mockImplementation((query, params, callback) => callback(null, []));

      const response = await request(app).get('/api/projects?status=completed');

      expect(response.status).toBe(200);
      expect(mockDb.all.mock.calls[0][0]).toContain('p.status = ?');
      expect(mockDb.all.mock.calls[0][1]).toEqual(['test@example.com', 'completed']);
    });

    test('filters by both client ID and status', async () => {
      mockDb.all.mockImplementation((query, params, callback) => callback(null, []));

      const response = await request(app).get('/api/projects?clientId=7&status=on-hold');

      expect(response.status).toBe(200);
      expect(mockDb.all.mock.calls[0][0]).toContain('p.user_email = ?');
      expect(mockDb.all.mock.calls[0][1]).toEqual(['test@example.com', 7, 'on-hold']);
    });

    test('rejects an invalid client ID filter', async () => {
      const response = await request(app).get('/api/projects?clientId=invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
      expect(mockDb.all).not.toHaveBeenCalled();
    });

    test('rejects an invalid status filter', async () => {
      const response = await request(app).get('/api/projects?status=archived');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid status' });
      expect(mockDb.all).not.toHaveBeenCalled();
    });

    test('returns an internal server error when listing fails', async () => {
      mockDb.all.mockImplementation((query, params, callback) => callback(new Error('Read failed')));

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/projects/:id', () => {
    test('returns a project', async () => {
      const project = { id: 1, name: 'Website', client_name: 'Client' };
      mockDb.get.mockImplementation((query, params, callback) => callback(null, project));

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ project });
      expect(mockDb.get.mock.calls[0][0]).toContain('JOIN clients c ON p.client_id = c.id');
      expect(mockDb.get.mock.calls[0][1]).toEqual([1, 'test@example.com']);
    });

    test('returns 404 for a project not owned by the user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, undefined));

      const response = await request(app).get('/api/projects/23');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('rejects an invalid project ID', async () => {
      const response = await request(app).get('/api/projects/not-a-number');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('returns an internal server error when reading a project fails', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(new Error('Read failed')));

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/projects', () => {
    test('creates a project with default status and preserves the date string', async () => {
      const createdProject = { id: 8, name: 'Website', start_date: '2026-04-17', status: 'active' };
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 5 }))
        .mockImplementationOnce((query, params, callback) => callback(null, createdProject));
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 8;
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Website', description: '', clientId: 5, startDate: '2026-04-17' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: 'Project created successfully',
        project: createdProject
      });
      expect(mockDb.run.mock.calls[0][0]).toContain(
        'INSERT INTO projects (name, description, client_id, start_date, status, user_email)'
      );
      expect(mockDb.run.mock.calls[0][1]).toEqual([
        'Website', null, 5, '2026-04-17', 'active', 'test@example.com'
      ]);
      expect(mockDb.get.mock.calls[1][0]).toContain('p.id = ? AND p.user_email = ?');
      expect(mockDb.get.mock.calls[1][1]).toEqual([8, 'test@example.com']);
    });

    test('stores a non-empty description', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 5 }))
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 8 }));
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 8;
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({
          name: 'Website',
          description: 'Launch details',
          clientId: 5,
          startDate: '2026-04-17'
        });

      expect(response.status).toBe(201);
      expect(mockDb.run.mock.calls[0][1]).toEqual([
        'Website', 'Launch details', 5, '2026-04-17', 'active', 'test@example.com'
      ]);
    });

    test('passes validation exceptions to the error handler', async () => {
      const validateSpy = jest.spyOn(projectSchema, 'validate').mockImplementation(() => {
        throw new Error('Unexpected validation failure');
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Website', clientId: 5, startDate: '2026-04-17' });

      validateSpy.mockRestore();
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Unexpected validation failure' });
    });

    test.each([
      ['missing name', { clientId: 5, startDate: '2026-04-17' }],
      ['missing clientId', { name: 'Website', startDate: '2026-04-17' }],
      ['invalid status', { name: 'Website', clientId: 5, startDate: '2026-04-17', status: 'archived' }],
      ['invalid startDate', { name: 'Website', clientId: 5, startDate: '04/17/2026' }]
    ])('rejects %s', async (description, body) => {
      const response = await request(app).post('/api/projects').send(body);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
      expect(mockDb.get).not.toHaveBeenCalled();
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('rejects a client that does not belong to the user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, undefined));

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Website', clientId: 5, startDate: '2026-04-17' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('handles an error checking client ownership', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(new Error('Read failed')));

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Website', clientId: 5, startDate: '2026-04-17' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('handles an insert error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 5 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('Insert failed')));

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Website', clientId: 5, startDate: '2026-04-17' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create project' });
    });

    test('handles an error retrieving a newly created project', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 5 }))
        .mockImplementationOnce((query, params, callback) => callback(new Error('Read failed')));
      mockDb.run.mockImplementation(function(query, params, callback) {
        this.lastID = 8;
        callback.call(this, null);
      });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Website', clientId: 5, startDate: '2026-04-17' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project created but failed to retrieve' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('updates all provided fields and verifies client ownership', async () => {
      const updatedProject = { id: 1, name: 'Updated', client_id: 9, status: 'completed' };
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 9 }))
        .mockImplementationOnce((query, params, callback) => callback(null, updatedProject));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app)
        .put('/api/projects/1')
        .send({
          name: 'Updated',
          description: '',
          clientId: 9,
          startDate: '2026-05-01',
          status: 'completed'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Project updated successfully',
        project: updatedProject
      });
      expect(mockDb.run.mock.calls[0][0]).toContain(
        'UPDATE projects SET name = ?, description = ?, client_id = ?, start_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?'
      );
      expect(mockDb.run.mock.calls[0][1]).toEqual([
        'Updated', null, 9, '2026-05-01', 'completed', 1, 'test@example.com'
      ]);
    });

    test('supports a status-only update without checking client ownership', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1, status: 'on-hold' }));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app).put('/api/projects/1').send({ status: 'on-hold' });

      expect(response.status).toBe(200);
      expect(mockDb.get).toHaveBeenCalledTimes(2);
      expect(mockDb.run.mock.calls[0][0]).toContain('UPDATE projects SET status = ?');
      expect(mockDb.run.mock.calls[0][1]).toEqual(['on-hold', 1, 'test@example.com']);
    });

    test('stores a non-empty updated description', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app)
        .put('/api/projects/1')
        .send({ description: 'Updated description' });

      expect(response.status).toBe(200);
      expect(mockDb.run.mock.calls[0][1]).toEqual([
        'Updated description', 1, 'test@example.com'
      ]);
    });

    test('passes update validation exceptions to the error handler', async () => {
      const validateSpy = jest.spyOn(updateProjectSchema, 'validate').mockImplementation(() => {
        throw new Error('Unexpected update validation failure');
      });

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });

      validateSpy.mockRestore();
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Unexpected update validation failure' });
    });

    test('rejects a client that does not belong to the user', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(null, undefined));

      const response = await request(app).put('/api/projects/1').send({ clientId: 9 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('rejects an empty update', async () => {
      const response = await request(app).put('/api/projects/1').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('rejects an invalid status update', async () => {
      const response = await request(app).put('/api/projects/1').send({ status: 'archived' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('returns 404 when the project is not owned by the user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, undefined));

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('rejects an invalid project ID', async () => {
      const response = await request(app).put('/api/projects/not-a-number').send({ name: 'Updated' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('handles an error checking project ownership', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(new Error('Read failed')));

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('handles an error checking updated client ownership', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(new Error('Read failed')));

      const response = await request(app).put('/api/projects/1').send({ clientId: 9 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('handles an update error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('Update failed')));

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update project' });
    });

    test('handles an error retrieving the updated project', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
        .mockImplementationOnce((query, params, callback) => callback(new Error('Read failed')));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project updated but failed to retrieve' });
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('deletes an existing project', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(null));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Project deleted successfully' });
      expect(mockDb.run.mock.calls[0][1]).toEqual([1, 'test@example.com']);
    });

    test('returns 404 when the project is not owned by the user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, undefined));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Project not found' });
    });

    test('rejects an invalid project ID', async () => {
      const response = await request(app).delete('/api/projects/not-a-number');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid project ID' });
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('handles an error checking project ownership', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(new Error('Read failed')));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('handles a delete error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => callback(null, { id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => callback(new Error('Delete failed')));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete project' });
    });
  });
});
