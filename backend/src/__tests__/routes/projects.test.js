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

const USER = 'test@example.com';
const DB_ERROR = new Error('Database error');

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

const toCallback = (result) => (query, params, callback) =>
  result instanceof Error ? callback(result, null) : callback(null, result);

const send = (method, url, body) => {
  const req = request(app)[method](url);
  return body === undefined ? req : req.send(body);
};

describe('Project Routes', () => {
  let mockDb;

  // Queue sequential db.get results; an Error instance is passed as the callback error.
  const queueGet = (...results) => {
    results.forEach((result) => mockDb.get.mockImplementationOnce(toCallback(result)));
  };

  const stubRun = (err = null) => {
    mockDb.run.mockImplementation((query, params, callback) => callback.call({ lastID: 1 }, err));
  };

  const expectResponse = async (method, url, body, status, expectedBody) => {
    const response = await send(method, url, body);
    expect(response.status).toBe(status);
    if (expectedBody !== undefined) {
      expect(response.body).toEqual(expectedBody);
    }
    return response;
  };

  beforeEach(() => {
    mockDb = { all: jest.fn(), get: jest.fn(), run: jest.fn() };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/projects', () => {
    test('should return all projects for authenticated user', async () => {
      mockDb.all.mockImplementation(toCallback([mockProject]));

      await expectResponse('get', '/api/projects', undefined, 200, { projects: [mockProject] });
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.user_email = ?'),
        [USER],
        expect.any(Function)
      );
    });

    test('should return empty array when no projects exist', async () => {
      mockDb.all.mockImplementation(toCallback([]));

      await expectResponse('get', '/api/projects', undefined, 200, { projects: [] });
    });

    test('should filter by clientId and status', async () => {
      mockDb.all.mockImplementation(toCallback([mockProject]));

      await expectResponse('get', '/api/projects?clientId=1&status=active', undefined, 200);
      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('AND p.client_id = ?');
      expect(query).toContain('AND p.status = ?');
      expect(params).toEqual([USER, 1, 'active']);
    });

    test.each([
      ['clientId=abc', 'Invalid client ID'],
      ['status=archived', 'Invalid project status']
    ])('should return 400 for invalid filter %s', async (qs, message) => {
      await expectResponse('get', `/api/projects?${qs}`, undefined, 400, { error: message });
      expect(mockDb.all).not.toHaveBeenCalled();
    });

    test('should handle database error', async () => {
      mockDb.all.mockImplementation(toCallback(DB_ERROR));

      await expectResponse('get', '/api/projects', undefined, 500, { error: 'Internal server error' });
    });
  });

  describe('invalid project ID and missing project', () => {
    test.each([
      ['get', undefined],
      ['put', { name: 'Updated' }],
      ['delete', undefined]
    ])('%s should return 400 for non-numeric id', async (method, body) => {
      await expectResponse(method, '/api/projects/invalid', body, 400, { error: 'Invalid project ID' });
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test.each([
      ['get', undefined],
      ['put', { name: 'Updated' }],
      ['delete', undefined]
    ])('%s should return 404 when project does not exist for user', async (method, body) => {
      queueGet(null);

      await expectResponse(method, '/api/projects/999', body, 404, { error: 'Project not found' });
      expect(mockDb.get.mock.calls[0][1]).toEqual([999, USER]);
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test.each([
      ['get', undefined],
      ['put', { name: 'Updated' }],
      ['delete', undefined]
    ])('%s should return 500 when project lookup fails', async (method, body) => {
      queueGet(DB_ERROR);

      await expectResponse(method, '/api/projects/1', body, 500, { error: 'Internal server error' });
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return specific project scoped to user', async () => {
      queueGet(mockProject);

      await expectResponse('get', '/api/projects/1', undefined, 200, { project: mockProject });
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.id = ? AND p.user_email = ?'),
        [1, USER],
        expect.any(Function)
      );
    });
  });

  describe('POST /api/projects', () => {
    test('should create new project with valid data', async () => {
      queueGet({ id: 1 }, mockProject);
      stubRun();

      const response = await expectResponse('post', '/api/projects', validProject, 201);
      expect(response.body).toEqual({ message: 'Project created successfully', project: mockProject });
      expect(mockDb.get.mock.calls[0][1]).toEqual([1, USER]);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        ['Website Redesign', 'Redesign marketing site', 1, '2024-01-15', 'active', USER],
        expect.any(Function)
      );
    });

    test('should default status to active and description to null', async () => {
      queueGet({ id: 1 }, mockProject);
      stubRun();

      await expectResponse('post', '/api/projects', { name: 'Minimal', clientId: 1, startDate: '2024-03-01' }, 201);
      expect(mockDb.run.mock.calls[0][1]).toEqual(['Minimal', null, 1, '2024-03-01', 'active', USER]);
    });

    test('should return 400 if client not found or not owned by user', async () => {
      queueGet(null);

      await expectResponse('post', '/api/projects', { ...validProject, clientId: 999 }, 400, {
        error: 'Client not found or does not belong to user'
      });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test.each([
      ['missing name', { name: undefined }],
      ['missing clientId', { clientId: undefined }],
      ['missing startDate', { startDate: undefined }],
      ['invalid startDate', { startDate: 'not-a-date' }],
      ['invalid status', { status: 'archived' }],
      ['non-positive clientId', { clientId: 0 }]
    ])('should return 400 for %s', async (label, overrides) => {
      await expectResponse('post', '/api/projects', { ...validProject, ...overrides }, 400);
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('should handle database error when checking client', async () => {
      queueGet(DB_ERROR);

      await expectResponse('post', '/api/projects', validProject, 500, { error: 'Internal server error' });
    });

    test('should handle database error on insert', async () => {
      queueGet({ id: 1 });
      stubRun(DB_ERROR);

      await expectResponse('post', '/api/projects', validProject, 500, { error: 'Failed to create project' });
    });

    test('should handle database error when retrieving created project', async () => {
      queueGet({ id: 1 }, DB_ERROR);
      stubRun();

      await expectResponse('post', '/api/projects', validProject, 500, {
        error: 'Project created but failed to retrieve'
      });
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project fields', async () => {
      const updatedProject = { ...mockProject, name: 'Updated', status: 'on-hold' };
      queueGet({ id: 1 }, updatedProject);
      stubRun();

      const response = await expectResponse('put', '/api/projects/1', { name: 'Updated', status: 'on-hold' }, 200);
      expect(response.body).toEqual({ message: 'Project updated successfully', project: updatedProject });

      const [query, params] = mockDb.run.mock.calls[0];
      expect(query).toContain('name = ?');
      expect(query).toContain('status = ?');
      expect(query).toContain('WHERE id = ? AND user_email = ?');
      expect(params).toEqual(['Updated', 'on-hold', 1, USER]);
    });

    test('should update description to null when empty string provided', async () => {
      queueGet({ id: 1 }, mockProject);
      stubRun();

      await expectResponse('put', '/api/projects/1', { description: '' }, 200);
      expect(mockDb.run.mock.calls[0][1]).toEqual([null, 1, USER]);
    });

    test('should update clientId and startDate after verifying client ownership', async () => {
      queueGet({ id: 1 }, { id: 2 }, mockProject);
      stubRun();

      await expectResponse('put', '/api/projects/1', { clientId: 2, startDate: '2024-02-01' }, 200);
      expect(mockDb.get.mock.calls[1][0]).toContain('FROM clients WHERE id = ? AND user_email = ?');
      expect(mockDb.get.mock.calls[1][1]).toEqual([2, USER]);
      expect(mockDb.run.mock.calls[0][1]).toEqual([2, '2024-02-01', 1, USER]);
    });

    test('should return 400 if new client not found', async () => {
      queueGet({ id: 1 }, null);

      await expectResponse('put', '/api/projects/1', { clientId: 999 }, 400, {
        error: 'Client not found or does not belong to user'
      });
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should handle database error when verifying new client', async () => {
      queueGet({ id: 1 }, DB_ERROR);

      await expectResponse('put', '/api/projects/1', { clientId: 2 }, 500, { error: 'Internal server error' });
    });

    test.each([
      ['empty body', {}],
      ['invalid status', { status: 'done' }]
    ])('should return 400 for %s', async (label, body) => {
      await expectResponse('put', '/api/projects/1', body, 400);
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    test('should handle database error on update', async () => {
      queueGet({ id: 1 });
      stubRun(DB_ERROR);

      await expectResponse('put', '/api/projects/1', { name: 'Updated' }, 500, { error: 'Failed to update project' });
    });

    test('should handle database error when retrieving updated project', async () => {
      queueGet({ id: 1 }, DB_ERROR);
      stubRun();

      await expectResponse('put', '/api/projects/1', { name: 'Updated' }, 500, {
        error: 'Project updated but failed to retrieve'
      });
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project', async () => {
      queueGet({ id: 1 });
      stubRun();

      await expectResponse('delete', '/api/projects/1', undefined, 200, { message: 'Project deleted successfully' });
      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM projects WHERE id = ? AND user_email = ?',
        [1, USER],
        expect.any(Function)
      );
    });

    test('should handle database error on delete', async () => {
      queueGet({ id: 1 });
      stubRun(DB_ERROR);

      await expectResponse('delete', '/api/projects/1', undefined, 500, { error: 'Failed to delete project' });
    });
  });
});
