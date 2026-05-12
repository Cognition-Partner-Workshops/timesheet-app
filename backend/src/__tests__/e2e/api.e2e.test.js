const request = require('supertest');
const express = require('express');
const { initializeDatabase, closeDatabase } = require('../../database/init');
const authRoutes = require('../../routes/auth');
const clientRoutes = require('../../routes/clients');
const workEntryRoutes = require('../../routes/workEntries');
const reportRoutes = require('../../routes/reports');
const { errorHandler } = require('../../middleware/errorHandler');

let app;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/work-entries', workEntryRoutes);
  app.use('/api/reports', reportRoutes);
  app.use(errorHandler);
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  await initializeDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

const TEST_EMAIL = 'e2e-test@example.com';
const OTHER_EMAIL = 'other-user@example.com';

// ─── Health Check ────────────────────────────────────────────────────────────

describe('GET /health', () => {
  test('should return 200 with status OK', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.timestamp).toBeDefined();
  });
});

// ─── Auth Endpoints ──────────────────────────────────────────────────────────

describe('Auth - /api/auth', () => {
  describe('POST /api/auth/login', () => {
    test('should create a new user on first login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('User created and logged in successfully');
      expect(res.body.user.email).toBe(TEST_EMAIL);
      expect(res.body.user.createdAt).toBeDefined();
    });

    test('should login existing user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.user.email).toBe(TEST_EMAIL);
    });

    test('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    test('should return 400 for missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });
  });

  describe('GET /api/auth/me', () => {
    test('should return current user info', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(TEST_EMAIL);
      expect(res.body.user.createdAt).toBeDefined();
    });

    test('should return 401 without x-user-email header', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User email required in x-user-email header');
    });

    test('should return 400 for invalid email in header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('x-user-email', 'bad-email');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid email format');
    });

    test('should auto-provision a new user via auth middleware', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('x-user-email', OTHER_EMAIL);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(OTHER_EMAIL);
    });
  });
});

// ─── Client Endpoints ────────────────────────────────────────────────────────

describe('Clients - /api/clients', () => {
  let clientId;
  let secondClientId;

  describe('POST /api/clients', () => {
    test('should create a client with all fields', async () => {
      const res = await request(app)
        .post('/api/clients')
        .set('x-user-email', TEST_EMAIL)
        .send({
          name: 'Acme Corp',
          description: 'Primary client',
          department: 'Engineering',
          email: 'contact@acme.com'
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Client created successfully');
      expect(res.body.client.name).toBe('Acme Corp');
      expect(res.body.client.description).toBe('Primary client');
      expect(res.body.client.department).toBe('Engineering');
      expect(res.body.client.email).toBe('contact@acme.com');
      expect(res.body.client.id).toBeDefined();

      clientId = res.body.client.id;
    });

    test('should create a client with only required fields', async () => {
      const res = await request(app)
        .post('/api/clients')
        .set('x-user-email', TEST_EMAIL)
        .send({ name: 'Beta Inc' });

      expect(res.status).toBe(201);
      expect(res.body.client.name).toBe('Beta Inc');

      secondClientId = res.body.client.id;
    });

    test('should return 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/clients')
        .set('x-user-email', TEST_EMAIL)
        .send({ description: 'No name given' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    test('should return 401 without auth header', async () => {
      const res = await request(app)
        .post('/api/clients')
        .send({ name: 'Unauthorized Client' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/clients', () => {
    test('should list all clients for the user', async () => {
      const res = await request(app)
        .get('/api/clients')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.clients)).toBe(true);
      expect(res.body.clients.length).toBeGreaterThanOrEqual(2);
    });

    test('should return empty array for user with no clients', async () => {
      const newEmail = 'no-clients@example.com';
      await request(app).post('/api/auth/login').send({ email: newEmail });

      const res = await request(app)
        .get('/api/clients')
        .set('x-user-email', newEmail);

      expect(res.status).toBe(200);
      expect(res.body.clients).toEqual([]);
    });

    test('should isolate clients by user', async () => {
      const res = await request(app)
        .get('/api/clients')
        .set('x-user-email', OTHER_EMAIL);

      expect(res.status).toBe(200);
      const names = res.body.clients.map(c => c.name);
      expect(names).not.toContain('Acme Corp');
    });
  });

  describe('GET /api/clients/:id', () => {
    test('should return a specific client', async () => {
      const res = await request(app)
        .get(`/api/clients/${clientId}`)
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(200);
      expect(res.body.client.id).toBe(clientId);
      expect(res.body.client.name).toBe('Acme Corp');
    });

    test('should return 404 for non-existent client', async () => {
      const res = await request(app)
        .get('/api/clients/99999')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Client not found');
    });

    test('should return 400 for invalid client ID', async () => {
      const res = await request(app)
        .get('/api/clients/abc')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid client ID');
    });

    test('should not return another user\'s client', async () => {
      const res = await request(app)
        .get(`/api/clients/${clientId}`)
        .set('x-user-email', OTHER_EMAIL);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/clients/:id', () => {
    test('should update client fields', async () => {
      const res = await request(app)
        .put(`/api/clients/${clientId}`)
        .set('x-user-email', TEST_EMAIL)
        .send({ name: 'Acme Corp Updated', department: 'Sales' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Client updated successfully');
      expect(res.body.client.name).toBe('Acme Corp Updated');
      expect(res.body.client.department).toBe('Sales');
    });

    test('should return 404 when updating non-existent client', async () => {
      const res = await request(app)
        .put('/api/clients/99999')
        .set('x-user-email', TEST_EMAIL)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });

    test('should return 400 for invalid client ID', async () => {
      const res = await request(app)
        .put('/api/clients/abc')
        .set('x-user-email', TEST_EMAIL)
        .send({ name: 'Invalid' });

      expect(res.status).toBe(400);
    });

    test('should return 400 when no fields provided', async () => {
      const res = await request(app)
        .put(`/api/clients/${clientId}`)
        .set('x-user-email', TEST_EMAIL)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    test('should not allow another user to update client', async () => {
      const res = await request(app)
        .put(`/api/clients/${clientId}`)
        .set('x-user-email', OTHER_EMAIL)
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/clients/:id', () => {
    test('should delete a specific client', async () => {
      const res = await request(app)
        .delete(`/api/clients/${secondClientId}`)
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Client deleted successfully');

      const check = await request(app)
        .get(`/api/clients/${secondClientId}`)
        .set('x-user-email', TEST_EMAIL);
      expect(check.status).toBe(404);
    });

    test('should return 404 for non-existent client', async () => {
      const res = await request(app)
        .delete('/api/clients/99999')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(404);
    });

    test('should return 400 for invalid client ID', async () => {
      const res = await request(app)
        .delete('/api/clients/abc')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(400);
    });
  });
});

// ─── Work Entry Endpoints ────────────────────────────────────────────────────

describe('Work Entries - /api/work-entries', () => {
  let clientId;
  let secondClientId;
  let entryId;
  let secondEntryId;

  beforeAll(async () => {
    const c1 = await request(app)
      .post('/api/clients')
      .set('x-user-email', TEST_EMAIL)
      .send({ name: 'Work Client A' });
    clientId = c1.body.client.id;

    const c2 = await request(app)
      .post('/api/clients')
      .set('x-user-email', TEST_EMAIL)
      .send({ name: 'Work Client B' });
    secondClientId = c2.body.client.id;
  });

  describe('POST /api/work-entries', () => {
    test('should create a work entry', async () => {
      const res = await request(app)
        .post('/api/work-entries')
        .set('x-user-email', TEST_EMAIL)
        .send({
          clientId: clientId,
          hours: 4.5,
          description: 'Backend development',
          date: '2025-01-15'
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Work entry created successfully');
      expect(res.body.workEntry.hours).toBe(4.5);
      expect(res.body.workEntry.client_name).toBe('Work Client A');
      expect(res.body.workEntry.id).toBeDefined();

      entryId = res.body.workEntry.id;
    });

    test('should create a second work entry for a different client', async () => {
      const res = await request(app)
        .post('/api/work-entries')
        .set('x-user-email', TEST_EMAIL)
        .send({
          clientId: secondClientId,
          hours: 2,
          description: 'Code review',
          date: '2025-01-16'
        });

      expect(res.status).toBe(201);
      secondEntryId = res.body.workEntry.id;
    });

    test('should create a work entry without description', async () => {
      const res = await request(app)
        .post('/api/work-entries')
        .set('x-user-email', TEST_EMAIL)
        .send({
          clientId: clientId,
          hours: 1,
          date: '2025-01-17'
        });

      expect(res.status).toBe(201);
    });

    test('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/work-entries')
        .set('x-user-email', TEST_EMAIL)
        .send({ description: 'No hours or client' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    test('should return 400 for invalid hours (> 24)', async () => {
      const res = await request(app)
        .post('/api/work-entries')
        .set('x-user-email', TEST_EMAIL)
        .send({
          clientId: clientId,
          hours: 25,
          date: '2025-01-15'
        });

      expect(res.status).toBe(400);
    });

    test('should return 400 for non-existent client', async () => {
      const res = await request(app)
        .post('/api/work-entries')
        .set('x-user-email', TEST_EMAIL)
        .send({
          clientId: 99999,
          hours: 1,
          date: '2025-01-15'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Client not found or does not belong to user');
    });

    test('should return 401 without auth header', async () => {
      const res = await request(app)
        .post('/api/work-entries')
        .send({ clientId: clientId, hours: 1, date: '2025-01-15' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/work-entries', () => {
    test('should list all work entries for the user', async () => {
      const res = await request(app)
        .get('/api/work-entries')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.workEntries)).toBe(true);
      expect(res.body.workEntries.length).toBeGreaterThanOrEqual(3);
    });

    test('should filter work entries by clientId', async () => {
      const res = await request(app)
        .get(`/api/work-entries?clientId=${clientId}`)
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(200);
      res.body.workEntries.forEach(entry => {
        expect(entry.client_id).toBe(clientId);
      });
    });

    test('should return 400 for invalid clientId query param', async () => {
      const res = await request(app)
        .get('/api/work-entries?clientId=abc')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(400);
    });

    test('should isolate work entries by user', async () => {
      const res = await request(app)
        .get('/api/work-entries')
        .set('x-user-email', OTHER_EMAIL);

      expect(res.status).toBe(200);
      expect(res.body.workEntries).toEqual([]);
    });
  });

  describe('GET /api/work-entries/:id', () => {
    test('should return a specific work entry', async () => {
      const res = await request(app)
        .get(`/api/work-entries/${entryId}`)
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(200);
      expect(res.body.workEntry.id).toBe(entryId);
      expect(res.body.workEntry.hours).toBe(4.5);
      expect(res.body.workEntry.client_name).toBe('Work Client A');
    });

    test('should return 404 for non-existent entry', async () => {
      const res = await request(app)
        .get('/api/work-entries/99999')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(404);
    });

    test('should return 400 for invalid entry ID', async () => {
      const res = await request(app)
        .get('/api/work-entries/abc')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(400);
    });

    test('should not return another user\'s entry', async () => {
      const res = await request(app)
        .get(`/api/work-entries/${entryId}`)
        .set('x-user-email', OTHER_EMAIL);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/work-entries/:id', () => {
    test('should update work entry fields', async () => {
      const res = await request(app)
        .put(`/api/work-entries/${entryId}`)
        .set('x-user-email', TEST_EMAIL)
        .send({ hours: 6, description: 'Updated work' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Work entry updated successfully');
      expect(res.body.workEntry.hours).toBe(6);
      expect(res.body.workEntry.description).toBe('Updated work');
    });

    test('should update work entry client assignment', async () => {
      const res = await request(app)
        .put(`/api/work-entries/${entryId}`)
        .set('x-user-email', TEST_EMAIL)
        .send({ clientId: secondClientId });

      expect(res.status).toBe(200);
      expect(res.body.workEntry.client_id).toBe(secondClientId);
      expect(res.body.workEntry.client_name).toBe('Work Client B');

      // Reassign back
      await request(app)
        .put(`/api/work-entries/${entryId}`)
        .set('x-user-email', TEST_EMAIL)
        .send({ clientId: clientId });
    });

    test('should return 404 for non-existent entry', async () => {
      const res = await request(app)
        .put('/api/work-entries/99999')
        .set('x-user-email', TEST_EMAIL)
        .send({ hours: 1 });

      expect(res.status).toBe(404);
    });

    test('should return 400 for invalid entry ID', async () => {
      const res = await request(app)
        .put('/api/work-entries/abc')
        .set('x-user-email', TEST_EMAIL)
        .send({ hours: 1 });

      expect(res.status).toBe(400);
    });

    test('should return 400 when no fields provided', async () => {
      const res = await request(app)
        .put(`/api/work-entries/${entryId}`)
        .set('x-user-email', TEST_EMAIL)
        .send({});

      expect(res.status).toBe(400);
    });

    test('should return 400 for assigning to non-existent client', async () => {
      const res = await request(app)
        .put(`/api/work-entries/${entryId}`)
        .set('x-user-email', TEST_EMAIL)
        .send({ clientId: 99999 });

      expect(res.status).toBe(400);
    });

    test('should not allow another user to update entry', async () => {
      const res = await request(app)
        .put(`/api/work-entries/${entryId}`)
        .set('x-user-email', OTHER_EMAIL)
        .send({ hours: 1 });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/work-entries/:id', () => {
    test('should delete a work entry', async () => {
      const res = await request(app)
        .delete(`/api/work-entries/${secondEntryId}`)
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Work entry deleted successfully');

      const check = await request(app)
        .get(`/api/work-entries/${secondEntryId}`)
        .set('x-user-email', TEST_EMAIL);
      expect(check.status).toBe(404);
    });

    test('should return 404 for non-existent entry', async () => {
      const res = await request(app)
        .delete('/api/work-entries/99999')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(404);
    });

    test('should return 400 for invalid entry ID', async () => {
      const res = await request(app)
        .delete('/api/work-entries/abc')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(400);
    });

    test('should not allow another user to delete entry', async () => {
      const res = await request(app)
        .delete(`/api/work-entries/${entryId}`)
        .set('x-user-email', OTHER_EMAIL);

      expect(res.status).toBe(404);
    });
  });
});

// ─── Report Endpoints ────────────────────────────────────────────────────────

describe('Reports - /api/reports', () => {
  let clientId;

  beforeAll(async () => {
    const client = await request(app)
      .post('/api/clients')
      .set('x-user-email', TEST_EMAIL)
      .send({ name: 'Report Client' });
    clientId = client.body.client.id;

    await request(app)
      .post('/api/work-entries')
      .set('x-user-email', TEST_EMAIL)
      .send({ clientId, hours: 3, description: 'Design work', date: '2025-02-01' });

    await request(app)
      .post('/api/work-entries')
      .set('x-user-email', TEST_EMAIL)
      .send({ clientId, hours: 5, description: 'Implementation', date: '2025-02-02' });
  });

  describe('GET /api/reports/client/:clientId', () => {
    test('should return hourly report with totals', async () => {
      const res = await request(app)
        .get(`/api/reports/client/${clientId}`)
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(200);
      expect(res.body.client.name).toBe('Report Client');
      expect(res.body.totalHours).toBe(8);
      expect(res.body.entryCount).toBe(2);
      expect(Array.isArray(res.body.workEntries)).toBe(true);
      expect(res.body.workEntries.length).toBe(2);
    });

    test('should return 404 for non-existent client', async () => {
      const res = await request(app)
        .get('/api/reports/client/99999')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(404);
    });

    test('should return 400 for invalid client ID', async () => {
      const res = await request(app)
        .get('/api/reports/client/abc')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(400);
    });

    test('should not return report for another user\'s client', async () => {
      const res = await request(app)
        .get(`/api/reports/client/${clientId}`)
        .set('x-user-email', OTHER_EMAIL);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/reports/export/csv/:clientId', () => {
    test('should export CSV file', async () => {
      const res = await request(app)
        .get(`/api/reports/export/csv/${clientId}`)
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv|application\/octet-stream/);

      const body = res.text || res.body.toString();
      expect(body).toContain('Date');
      expect(body).toContain('Hours');
      expect(body).toContain('Description');
    });

    test('should return 404 for non-existent client', async () => {
      const res = await request(app)
        .get('/api/reports/export/csv/99999')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(404);
    });

    test('should return 400 for invalid client ID', async () => {
      const res = await request(app)
        .get('/api/reports/export/csv/abc')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/reports/export/pdf/:clientId', () => {
    test('should export PDF file', async () => {
      const res = await request(app)
        .get(`/api/reports/export/pdf/${clientId}`)
        .set('x-user-email', TEST_EMAIL)
        .buffer(true);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/attachment.*\.pdf/);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('should return 404 for non-existent client', async () => {
      const res = await request(app)
        .get('/api/reports/export/pdf/99999')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(404);
    });

    test('should return 400 for invalid client ID', async () => {
      const res = await request(app)
        .get('/api/reports/export/pdf/abc')
        .set('x-user-email', TEST_EMAIL);

      expect(res.status).toBe(400);
    });
  });
});

// ─── Delete All Clients ──────────────────────────────────────────────────────

describe('DELETE /api/clients (bulk delete)', () => {
  beforeAll(async () => {
    const email = 'bulk-delete@example.com';
    await request(app).post('/api/auth/login').send({ email });

    await request(app)
      .post('/api/clients')
      .set('x-user-email', email)
      .send({ name: 'Bulk A' });

    await request(app)
      .post('/api/clients')
      .set('x-user-email', email)
      .send({ name: 'Bulk B' });
  });

  test('should delete all clients for the user', async () => {
    const email = 'bulk-delete@example.com';

    const res = await request(app)
      .delete('/api/clients')
      .set('x-user-email', email);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('All clients deleted successfully');
    expect(res.body.deletedCount).toBe(2);

    const list = await request(app)
      .get('/api/clients')
      .set('x-user-email', email);
    expect(list.body.clients).toEqual([]);
  });
});

// ─── Cascade Delete ──────────────────────────────────────────────────────────

describe('Cascade delete - deleting client removes its work entries', () => {
  test('work entries should be removed when client is deleted', async () => {
    const email = 'cascade-test@example.com';
    await request(app).post('/api/auth/login').send({ email });

    const client = await request(app)
      .post('/api/clients')
      .set('x-user-email', email)
      .send({ name: 'Cascade Client' });
    const cid = client.body.client.id;

    await request(app)
      .post('/api/work-entries')
      .set('x-user-email', email)
      .send({ clientId: cid, hours: 2, date: '2025-03-01' });

    const before = await request(app)
      .get('/api/work-entries')
      .set('x-user-email', email);
    expect(before.body.workEntries.length).toBe(1);

    await request(app)
      .delete(`/api/clients/${cid}`)
      .set('x-user-email', email);

    const after = await request(app)
      .get('/api/work-entries')
      .set('x-user-email', email);
    expect(after.body.workEntries.length).toBe(0);
  });
});

// ─── 404 Route ───────────────────────────────────────────────────────────────

describe('Unknown routes', () => {
  test('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route not found');
  });
});
