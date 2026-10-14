const request = require('supertest');
const express = require('express');
const { initializeDatabase, closeDatabase } = require('../../database/init');
const authRoutes = require('../../routes/auth');
const clientRoutes = require('../../routes/clients');
const workEntryRoutes = require('../../routes/workEntries');
const { errorHandler } = require('../../middleware/errorHandler');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/work-entries', workEntryRoutes);
app.use(errorHandler);

const TEST_EMAIL = 'functionaltest@example.com';

describe('Functional Test: Login with email and log a work entry', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  let clientId;

  describe('Step 1: Login with email', () => {
    it('should login successfully with a valid email and auto-create user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User created and logged in successfully');
      expect(response.body.user.email).toBe(TEST_EMAIL);
    });

    it('should return login successful on subsequent login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.email).toBe(TEST_EMAIL);
    });

    it('should retrieve current user info via /me endpoint', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('x-user-email', TEST_EMAIL);

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe(TEST_EMAIL);
      expect(response.body.user.createdAt).toBeDefined();
    });
  });

  describe('Step 2: Create a client to associate work entries', () => {
    it('should create a new client', async () => {
      const response = await request(app)
        .post('/api/clients')
        .set('x-user-email', TEST_EMAIL)
        .send({
          name: 'Test Client Corp',
          description: 'Client for functional testing',
          department: 'Engineering',
          email: 'client@testcorp.com'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Client created successfully');
      expect(response.body.client.name).toBe('Test Client Corp');
      expect(response.body.client.id).toBeDefined();

      clientId = response.body.client.id;
    });
  });

  describe('Step 3: Log work entries', () => {
    it('should log a work entry for the created client', async () => {
      const response = await request(app)
        .post('/api/work-entries')
        .set('x-user-email', TEST_EMAIL)
        .send({
          clientId: clientId,
          hours: 4.5,
          description: 'Implemented feature X',
          date: '2025-01-15'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Work entry created successfully');
      expect(response.body.workEntry.hours).toBe(4.5);
      expect(response.body.workEntry.description).toBe('Implemented feature X');
      expect(response.body.workEntry.date).toBeDefined();
      expect(response.body.workEntry.client_name).toBe('Test Client Corp');
    });

    it('should log a second work entry for the same client', async () => {
      const response = await request(app)
        .post('/api/work-entries')
        .set('x-user-email', TEST_EMAIL)
        .send({
          clientId: clientId,
          hours: 3.0,
          description: 'Code review and bug fixes',
          date: '2025-01-16'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Work entry created successfully');
      expect(response.body.workEntry.hours).toBe(3);
      expect(response.body.workEntry.description).toBe('Code review and bug fixes');
      expect(response.body.workEntry.date).toBeDefined();
    });

    it('should list all work entries for the authenticated user', async () => {
      const response = await request(app)
        .get('/api/work-entries')
        .set('x-user-email', TEST_EMAIL);

      expect(response.status).toBe(200);
      expect(response.body.workEntries).toHaveLength(2);
      expect(response.body.workEntries[0].client_name).toBe('Test Client Corp');
    });
  });
});
