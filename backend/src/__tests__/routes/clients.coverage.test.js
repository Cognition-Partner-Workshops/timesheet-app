const { request, createTestApp, setupMockDb, mockRunWithChanges, mockRunWithLastID, mockDbError, mockDbRow, mockDbRows, mockGetDatabaseThrow } = require('../helpers/testSetup');
const { getDatabase } = require('../../database/init');
const clientRoutes = require('../../routes/clients');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const app = createTestApp('/api/clients', clientRoutes);

describe('Client Routes - Coverage Improvement', () => {
  let mockDb;

  beforeEach(() => { mockDb = setupMockDb(); });
  afterEach(() => { jest.clearAllMocks(); });

  describe('DELETE /api/clients (delete all)', () => {
    test('should delete all clients for authenticated user', async () => {
      mockDb.run.mockImplementation(mockRunWithChanges(3));
      const response = await request(app).delete('/api/clients');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ message: 'All clients deleted successfully', deletedCount: 3 });
    });

    test('should return 0 deleted count when no clients exist', async () => {
      mockDb.run.mockImplementation(mockRunWithChanges(0));
      const response = await request(app).delete('/api/clients');
      expect(response.status).toBe(200);
      expect(response.body.deletedCount).toBe(0);
    });

    test('should handle database error when deleting all clients', async () => {
      mockDb.run.mockImplementation(mockDbError('Delete all failed'));
      const response = await request(app).delete('/api/clients');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete clients' });
    });

    test('should only delete clients belonging to authenticated user', async () => {
      mockDb.run.mockImplementation(mockRunWithChanges(1));
      await request(app).delete('/api/clients');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM clients WHERE user_email = ?'),
        ['test@example.com'],
        expect.any(Function)
      );
    });
  });

  describe('PUT /api/clients/:id - Department and Email Fields', () => {
    function setupUpdateMocks(updatedClient, queryAssertions) {
      mockDb.get.mockImplementationOnce(mockDbRow({ id: 1 }));
      mockDb.run.mockImplementation((query, params, callback) => {
        if (queryAssertions) queryAssertions(query);
        callback(null);
      });
      mockDb.get.mockImplementationOnce(mockDbRow(updatedClient));
    }

    test('should update client department', async () => {
      setupUpdateMocks({ id: 1, name: 'Client', department: 'Engineering' },
        (q) => expect(q).toContain('department = ?'));
      const response = await request(app).put('/api/clients/1').send({ department: 'Engineering' });
      expect(response.status).toBe(200);
      expect(response.body.client.department).toBe('Engineering');
    });

    test('should update client email', async () => {
      setupUpdateMocks({ id: 1, name: 'Client', email: 'new@example.com' },
        (q) => expect(q).toContain('email = ?'));
      const response = await request(app).put('/api/clients/1').send({ email: 'new@example.com' });
      expect(response.status).toBe(200);
      expect(response.body.client.email).toBe('new@example.com');
    });

    test('should update all client fields simultaneously', async () => {
      const updatedClient = { id: 1, name: 'New Name', description: 'New Desc', department: 'Sales', email: 'sales@example.com' };
      setupUpdateMocks(updatedClient, (q) => {
        ['name = ?', 'description = ?', 'department = ?', 'email = ?'].forEach(f => expect(q).toContain(f));
      });
      const response = await request(app).put('/api/clients/1')
        .send({ name: 'New Name', description: 'New Desc', department: 'Sales', email: 'sales@example.com' });
      expect(response.status).toBe(200);
      expect(response.body.client).toEqual(updatedClient);
    });

    test('should set department to null when empty string provided', async () => {
      setupUpdateMocks({ id: 1, name: 'Client', department: null });
      const response = await request(app).put('/api/clients/1').send({ department: '' });
      expect(response.status).toBe(200);
    });

    test('should set email to null when empty string provided', async () => {
      setupUpdateMocks({ id: 1, name: 'Client', email: null });
      const response = await request(app).put('/api/clients/1').send({ email: '' });
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/clients - Additional Fields', () => {
    test('should create client with all optional fields', async () => {
      const newClient = { name: 'Full Client', description: 'Full description', department: 'Engineering', email: 'client@example.com' };
      mockDb.run.mockImplementation(mockRunWithLastID(1));
      mockDb.get.mockImplementation(mockDbRow({ id: 1, ...newClient }));

      const response = await request(app).post('/api/clients').send(newClient);
      expect(response.status).toBe(201);
      expect(response.body.client).toEqual({ id: 1, ...newClient });
    });

    test('should handle null optional fields on creation', async () => {
      mockDb.run.mockImplementation(mockRunWithLastID(1));
      mockDb.get.mockImplementation(mockDbRow({ id: 1, name: 'Minimal Client', description: null, department: null, email: null }));
      const response = await request(app).post('/api/clients').send({ name: 'Minimal Client' });
      expect(response.status).toBe(201);
    });

    test.each([
      ['POST', () => request(app).post('/api/clients').send({ name: 'Test' })],
      ['PUT', () => request(app).put('/api/clients/1').send({ name: 'Updated' })]
    ])('should handle unexpected error in %s handler', async (_, makeRequest) => {
      mockGetDatabaseThrow();
      const response = await makeRequest();
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/clients - Edge Cases', () => {
    test('should handle large number of clients', async () => {
      const mockClients = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `Client ${i + 1}` }));
      mockDb.all.mockImplementation(mockDbRows(mockClients));
      const response = await request(app).get('/api/clients');
      expect(response.status).toBe(200);
      expect(response.body.clients).toHaveLength(50);
    });
  });

  describe('DELETE /api/clients/:id - Edge Cases', () => {
    beforeEach(() => { mockDb.get.mockImplementation(mockDbRow(null)); });
    test.each([['ID 0', '0'], ['large ID', '999999999']])('should return 404 for %s', async (_, id) => {
      const response = await request(app).delete(`/api/clients/${id}`);
      expect(response.status).toBe(404);
    });
  });
});
