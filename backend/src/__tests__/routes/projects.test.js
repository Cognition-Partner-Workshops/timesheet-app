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
  description: 'Rebuild the marketing site',
  clientId: 1,
  startDate: '2024-01-01',
  status: 'active'
};

describe('Project Routes', () => {
  let mockDb;

  const mockGetOnce = (err, row) => {
    mockDb.get.mockImplementationOnce((query, params, callback) => callback(err, row));
  };

  const mockRunOnce = (err, lastID = 1) => {
    mockDb.run.mockImplementationOnce(function(query, params, callback) {
      this.lastID = lastID;
      callback.call(this, err);
    });
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
      const mockProjects = [
        { id: 1, name: 'Project A', client_id: 1, client_name: 'Client A', start_date: '2024-01-01', status: 'active' },
        { id: 2, name: 'Project B', client_id: 2, client_name: 'Client B', start_date: '2024-02-01', status: 'completed' }
      ];

      mockDb.all.mockImplementation((query, params, callback) => callback(null, mockProjects));

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
      mockDb.all.mockImplementation((query, params, callback) => callback(null, []));

      const response = await request(app).get('/api/projects?clientId=5');

      expect(response.status).toBe(200);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND p.client_id = ?'),
        ['test@example.com', 5],
        expect.any(Function)
      );
    });

    test('should return 400 for invalid clientId filter', async () => {
      const response = await request(app).get('/api/projects?clientId=invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });

    test('should handle database error', async () => {
      mockDb.all.mockImplementation((query, params, callback) => callback(new Error('Database error'), null));

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project', async () => {
      const mockProject = { id: 1, name: 'Project A', client_name: 'Client A' };
      mockGetOnce(null, mockProject);

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ project: mockProject });
    });

    test('should return 404 if project not found', async () => {
      mockGetOnce(null, null);

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
      mockGetOnce(new Error('Database error'), null);

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/projects', () => {
    test('should create new project with valid data', async () => {
      const createdProject = { id: 1, ...validProject, client_name: 'Client A' };

      mockGetOnce(null, { id: 1 }); // client ownership check
      mockRunOnce(null);
      mockGetOnce(null, createdProject); // retrieve created project

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.project).toEqual(createdProject);
    });

    test('should default status to active when omitted', async () => {
      mockGetOnce(null, { id: 1 });
      mockRunOnce(null);
      mockGetOnce(null, { id: 1, status: 'active' });

      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'No Status', clientId: 1, startDate: '2024-01-01' });

      expect(response.status).toBe(201);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        ['No Status', null, 1, 'test@example.com', expect.anything(), 'active'],
        expect.any(Function)
      );
    });

    test('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ clientId: 1, startDate: '2024-01-01' });

      expect(response.status).toBe(400);
    });

    test('should return 400 for missing startDate', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'No Date', clientId: 1 });

      expect(response.status).toBe(400);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ ...validProject, status: 'archived' });

      expect(response.status).toBe(400);
    });

    test('should return 400 when client does not belong to user', async () => {
      mockGetOnce(null, null);

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('should handle database error when verifying client', async () => {
      mockGetOnce(new Error('Database error'), null);

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database insert error', async () => {
      mockGetOnce(null, { id: 1 });
      mockRunOnce(new Error('Insert failed'));

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create project' });
    });

    test('should handle error retrieving project after creation', async () => {
      mockGetOnce(null, { id: 1 });
      mockRunOnce(null);
      mockGetOnce(new Error('Retrieval failed'), null);

      const response = await request(app).post('/api/projects').send(validProject);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project created but failed to retrieve' });
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project name', async () => {
      const updatedProject = { id: 1, name: 'Updated Name' };

      mockGetOnce(null, { id: 1 }); // project exists
      mockRunOnce(null);
      mockGetOnce(null, updatedProject);

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project updated successfully');
      expect(response.body.project).toEqual(updatedProject);
    });

    test('should update status', async () => {
      mockGetOnce(null, { id: 1 });
      mockRunOnce(null);
      mockGetOnce(null, { id: 1, status: 'on-hold' });

      const response = await request(app).put('/api/projects/1').send({ status: 'on-hold' });

      expect(response.status).toBe(200);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('status = ?'),
        ['on-hold', 1, 'test@example.com'],
        expect.any(Function)
      );
    });

    test('should verify new client ownership when reassigning', async () => {
      mockGetOnce(null, { id: 1 }); // project exists
      mockGetOnce(null, { id: 2 }); // new client owned
      mockRunOnce(null);
      mockGetOnce(null, { id: 1, client_id: 2 });

      const response = await request(app).put('/api/projects/1').send({ clientId: 2 });

      expect(response.status).toBe(200);
      expect(response.body.project).toEqual({ id: 1, client_id: 2 });
    });

    test('should return 400 when reassigning to a client the user does not own', async () => {
      mockGetOnce(null, { id: 1 }); // project exists
      mockGetOnce(null, null); // client not owned

      const response = await request(app).put('/api/projects/1').send({ clientId: 99 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Client not found or does not belong to user' });
    });

    test('should return 404 if project not found', async () => {
      mockGetOnce(null, null);

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

    test('should handle database error when checking project existence', async () => {
      mockGetOnce(new Error('Database error'), null);

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error during update', async () => {
      mockGetOnce(null, { id: 1 });
      mockRunOnce(new Error('Update failed'));

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update project' });
    });

    test('should handle error retrieving project after update', async () => {
      mockGetOnce(null, { id: 1 });
      mockRunOnce(null);
      mockGetOnce(new Error('Retrieval failed'), null);

      const response = await request(app).put('/api/projects/1').send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Project updated but failed to retrieve' });
    });

    test('should set description to null when empty string provided', async () => {
      mockGetOnce(null, { id: 1 });
      mockRunOnce(null);
      mockGetOnce(null, { id: 1, description: null });

      const response = await request(app).put('/api/projects/1').send({ description: '' });

      expect(response.status).toBe(200);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('description = ?'),
        [null, 1, 'test@example.com'],
        expect.any(Function)
      );
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete existing project', async () => {
      mockGetOnce(null, { id: 1 });
      mockRunOnce(null);

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Project deleted successfully' });
    });

    test('should return 404 if project not found', async () => {
      mockGetOnce(null, null);

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
      mockGetOnce(null, { id: 1 });
      mockRunOnce(new Error('Delete failed'));

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete project' });
    });

    test('should handle database error when checking project existence', async () => {
      mockGetOnce(new Error('Database error'), null);

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });
});
