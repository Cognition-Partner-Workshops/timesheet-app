const request = require('supertest');
const express = require('express');
const { initializeDatabase, closeDatabase } = require('../../database/init');
const authRoutes = require('../../routes/auth');
const clientRoutes = require('../../routes/clients');
const workEntryRoutes = require('../../routes/workEntries');
const reportRoutes = require('../../routes/reports');
const { errorHandler } = require('../../middleware/errorHandler');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/work-entries', workEntryRoutes);
app.use('/api/reports', reportRoutes);
app.use(errorHandler);

const TEST_EMAIL = 'reporttest@example.com';

describe('Functional Test: Gather report for added entries and validate', () => {
  let clientId;

  beforeAll(async () => {
    await initializeDatabase();

    // Setup: Login user
    await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL });

    // Setup: Create a client
    const clientRes = await request(app)
      .post('/api/clients')
      .set('x-user-email', TEST_EMAIL)
      .send({
        name: 'Report Test Client',
        description: 'Client for report validation',
        department: 'QA'
      });
    clientId = clientRes.body.client.id;

    // Setup: Add multiple work entries
    await request(app)
      .post('/api/work-entries')
      .set('x-user-email', TEST_EMAIL)
      .send({
        clientId: clientId,
        hours: 8,
        description: 'Full day development sprint',
        date: '2025-02-01'
      });

    await request(app)
      .post('/api/work-entries')
      .set('x-user-email', TEST_EMAIL)
      .send({
        clientId: clientId,
        hours: 6.5,
        description: 'Testing and documentation',
        date: '2025-02-02'
      });

    await request(app)
      .post('/api/work-entries')
      .set('x-user-email', TEST_EMAIL)
      .send({
        clientId: clientId,
        hours: 3.25,
        description: 'Bug triage and prioritization',
        date: '2025-02-03'
      });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('Step 1: Retrieve the report for the client', () => {
    it('should return the hourly report with all entries and correct totals', async () => {
      const response = await request(app)
        .get(`/api/reports/client/${clientId}`)
        .set('x-user-email', TEST_EMAIL);

      expect(response.status).toBe(200);
      expect(response.body.client).toBeDefined();
      expect(response.body.client.name).toBe('Report Test Client');
      expect(response.body.workEntries).toHaveLength(3);
      expect(response.body.entryCount).toBe(3);
      expect(response.body.totalHours).toBe(17.75);
    });
  });

  describe('Step 2: Validate individual entries in the report', () => {
    it('should contain all three entries with date fields populated', async () => {
      const response = await request(app)
        .get(`/api/reports/client/${clientId}`)
        .set('x-user-email', TEST_EMAIL);

      const entries = response.body.workEntries;
      expect(entries).toHaveLength(3);
      entries.forEach((entry) => {
        expect(entry.date).toBeDefined();
      });
    });

    it('should have correct hours and descriptions for each entry', async () => {
      const response = await request(app)
        .get(`/api/reports/client/${clientId}`)
        .set('x-user-email', TEST_EMAIL);

      const entries = response.body.workEntries;
      const descriptions = entries.map((e) => e.description);
      const hours = entries.map((e) => e.hours);

      expect(descriptions).toContain('Full day development sprint');
      expect(descriptions).toContain('Testing and documentation');
      expect(descriptions).toContain('Bug triage and prioritization');

      expect(hours).toContain(8);
      expect(hours).toContain(6.5);
      expect(hours).toContain(3.25);
    });
  });

  describe('Step 3: Validate report export functionality', () => {
    it('should export the report as CSV with correct data', async () => {
      const response = await request(app)
        .get(`/api/reports/export/csv/${clientId}`)
        .set('x-user-email', TEST_EMAIL);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/octet-stream|csv/);

      const csvContent = response.text || response.body.toString();
      expect(csvContent).toContain('Date');
      expect(csvContent).toContain('Hours');
      expect(csvContent).toContain('Description');
      expect(csvContent).toContain('Full day development sprint');
      expect(csvContent).toContain('Testing and documentation');
      expect(csvContent).toContain('Bug triage and prioritization');
    });
  });

  describe('Step 4: Validate data isolation', () => {
    it('should not return report for a different user', async () => {
      const response = await request(app)
        .get(`/api/reports/client/${clientId}`)
        .set('x-user-email', 'otheruser@example.com');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Client not found');
    });
  });
});
