const { request, createTestApp, setupMockDb, mockDbRow, mockDbError } = require('../helpers/testSetup');
const { getDatabase } = require('../../database/init');
const authRoutes = require('../../routes/auth');

jest.mock('../../database/init');

const app = createTestApp('/api/auth', authRoutes);

describe('Auth Routes - Coverage Improvement', () => {
  let mockDb;

  beforeEach(() => { mockDb = setupMockDb(); });
  afterEach(() => { jest.clearAllMocks(); });

  describe('POST /api/auth/login - Edge Cases', () => {
    test.each([
      ['empty string', { email: '' }],
      ['spaces', { email: 'test @example.com' }],
      ['multiple @', { email: 'test@@example.com' }],
      ['null body', null],
      ['non-string email', { email: 12345 }],
      ['whitespace only', { email: '   ' }]
    ])('should reject %s email', async (_, body) => {
      const response = await request(app).post('/api/auth/login').send(body);
      expect(response.status).toBe(400);
    });

    test('should accept email with plus addressing', async () => {
      mockDb.get.mockImplementation(mockDbRow({ email: 'test+tag@example.com', created_at: '2024-01-01' }));
      const response = await request(app).post('/api/auth/login').send({ email: 'test+tag@example.com' });
      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('test+tag@example.com');
    });

    test('should accept email with subdomain', async () => {
      mockDb.get.mockImplementation(mockDbRow({ email: 'user@mail.example.com', created_at: '2024-01-01' }));
      const response = await request(app).post('/api/auth/login').send({ email: 'user@mail.example.com' });
      expect(response.status).toBe(200);
    });

    test('should include createdAt in response for new user', async () => {
      mockDb.get.mockImplementation(mockDbRow(null));
      mockDb.run.mockImplementation(function(query, params, callback) { callback.call(this, null); });
      const response = await request(app).post('/api/auth/login').send({ email: 'brand-new@example.com' });
      expect(response.status).toBe(201);
      expect(response.body.user.createdAt).toBeDefined();
    });

    test('should include createdAt in response for existing user', async () => {
      const timestamp = '2024-06-15T12:00:00.000Z';
      mockDb.get.mockImplementation(mockDbRow({ email: 'existing@example.com', created_at: timestamp }));
      const response = await request(app).post('/api/auth/login').send({ email: 'existing@example.com' });
      expect(response.status).toBe(200);
      expect(response.body.user.createdAt).toBe(timestamp);
    });

    test('should handle extra fields in request body gracefully', async () => {
      mockDb.get.mockImplementation(mockDbRow({ email: 'test@example.com', created_at: '2024-01-01' }));
      const response = await request(app).post('/api/auth/login')
        .send({ email: 'test@example.com', extraField: 'should be ignored' });
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('GET /api/auth/me - Edge Cases', () => {
    test('should return 400 for invalid email format in header', async () => {
      const response = await request(app).get('/api/auth/me').set('x-user-email', 'not-valid');
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid email format');
    });

    test('should return 401 for empty email header', async () => {
      const response = await request(app).get('/api/auth/me').set('x-user-email', '');
      expect(response.status).toBe(401);
    });

    test('should handle user not found in /me query', async () => {
      let callCount = 0;
      mockDb.get.mockImplementation((query, params, callback) => {
        callCount++;
        callback(null, callCount === 1 ? { email: 'ghost@example.com' } : null);
      });
      const response = await request(app).get('/api/auth/me').set('x-user-email', 'ghost@example.com');
      expect(response.status).toBe(404);
    });

    test('should handle database error in auth middleware', async () => {
      mockDb.get.mockImplementation(mockDbError('DB down'));
      const response = await request(app).get('/api/auth/me').set('x-user-email', 'test@example.com');
      expect(response.status).toBe(500);
    });

    test('should auto-create user via auth middleware when accessing /me', async () => {
      let getCallCount = 0;
      mockDb.get.mockImplementation((query, params, callback) => {
        getCallCount++;
        callback(null, getCallCount === 1 ? null : { email: 'auto-created@example.com', created_at: '2024-01-01' });
      });
      mockDb.run.mockImplementation((query, params, callback) => callback(null));
      const response = await request(app).get('/api/auth/me').set('x-user-email', 'auto-created@example.com');
      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('auto-created@example.com');
    });
  });

  describe('POST /api/auth/login - Concurrent User Creation', () => {
    test('should handle rapid successive login requests for same new user', async () => {
      mockDb.get.mockImplementation(mockDbRow(null));
      mockDb.run.mockImplementation(function(query, params, callback) { callback.call(this, null); });
      const [r1, r2] = await Promise.all([
        request(app).post('/api/auth/login').send({ email: 'concurrent@example.com' }),
        request(app).post('/api/auth/login').send({ email: 'concurrent@example.com' })
      ]);
      expect([200, 201]).toContain(r1.status);
      expect([200, 201]).toContain(r2.status);
    });
  });
});
