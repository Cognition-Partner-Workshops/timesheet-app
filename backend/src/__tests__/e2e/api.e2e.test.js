const request = require('supertest');
const { getApp, teardown } = require('./steps/shared-setup');

let app;

beforeAll(async () => { app = await getApp(); });
afterAll(async () => { await teardown(); });

const TEST_EMAIL = 'e2e-test@example.com';
const OTHER_EMAIL = 'other-user@example.com';

// ─── Request Helpers ─────────────────────────────────────────────────────────

function authedGet(path, email = TEST_EMAIL) {
  return request(app).get(path).set('x-user-email', email);
}

function authedPost(path, body, email = TEST_EMAIL) {
  return request(app).post(path).set('x-user-email', email).send(body);
}

function authedPut(path, body, email = TEST_EMAIL) {
  return request(app).put(path).set('x-user-email', email).send(body);
}

function authedDelete(path, email = TEST_EMAIL) {
  return request(app).delete(path).set('x-user-email', email);
}

function login(email) {
  return request(app).post('/api/auth/login').send({ email });
}

async function createClient(name, email = TEST_EMAIL) {
  const res = await authedPost('/api/clients', { name }, email);
  return res.body.client.id;
}

async function createWorkEntry(clientId, hours, date, description, email = TEST_EMAIL) {
  const body = { clientId, hours, date };
  if (description) body.description = description;
  return authedPost('/api/work-entries', body, email);
}

// ─── Error-pattern helpers ───────────────────────────────────────────────────

function addIdErrorTests(method, basePath, body) {
  test('should return 404 for non-existent ID', async () => {
    const res = body ? method(`${basePath}/99999`, body) : method(`${basePath}/99999`);
    expect((await res).status).toBe(404);
  });
  test('should return 400 for invalid ID', async () => {
    const res = body ? method(`${basePath}/abc`, body) : method(`${basePath}/abc`);
    expect((await res).status).toBe(400);
  });
}

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
      const res = await login(TEST_EMAIL);
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('User created and logged in successfully');
      expect(res.body.user.email).toBe(TEST_EMAIL);
      expect(res.body.user.createdAt).toBeDefined();
    });

    test('should login existing user', async () => {
      const res = await login(TEST_EMAIL);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.user.email).toBe(TEST_EMAIL);
    });

    test('should return 400 for invalid email format', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    test('should return 400 for missing email', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });
  });

  describe('GET /api/auth/me', () => {
    test('should return current user info', async () => {
      const res = await authedGet('/api/auth/me');
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
      const res = await authedGet('/api/auth/me', 'bad-email');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid email format');
    });

    test('should auto-provision a new user via auth middleware', async () => {
      const res = await authedGet('/api/auth/me', OTHER_EMAIL);
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
      const payload = {
        name: 'Acme Corp',
        description: 'Primary client',
        department: 'Engineering',
        email: 'contact@acme.com'
      };
      const res = await authedPost('/api/clients', payload);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Client created successfully');
      expect(res.body.client).toMatchObject(payload);
      expect(res.body.client.id).toBeDefined();
      clientId = res.body.client.id;
    });

    test('should create a client with only required fields', async () => {
      const res = await authedPost('/api/clients', { name: 'Beta Inc' });
      expect(res.status).toBe(201);
      expect(res.body.client.name).toBe('Beta Inc');
      secondClientId = res.body.client.id;
    });

    test('should return 400 for missing name', async () => {
      const res = await authedPost('/api/clients', { description: 'No name given' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    test('should return 401 without auth header', async () => {
      const res = await request(app).post('/api/clients').send({ name: 'Unauthorized' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/clients', () => {
    test('should list all clients for the user', async () => {
      const res = await authedGet('/api/clients');
      expect(res.status).toBe(200);
      expect(res.body.clients.length).toBeGreaterThanOrEqual(2);
    });

    test('should return empty array for user with no clients', async () => {
      const email = 'no-clients@example.com';
      await login(email);
      const res = await authedGet('/api/clients', email);
      expect(res.status).toBe(200);
      expect(res.body.clients).toEqual([]);
    });

    test('should isolate clients by user', async () => {
      const res = await authedGet('/api/clients', OTHER_EMAIL);
      expect(res.status).toBe(200);
      expect(res.body.clients.map(c => c.name)).not.toContain('Acme Corp');
    });
  });

  describe('GET /api/clients/:id', () => {
    test('should return a specific client', async () => {
      const res = await authedGet(`/api/clients/${clientId}`);
      expect(res.status).toBe(200);
      expect(res.body.client.id).toBe(clientId);
    });

    addIdErrorTests(authedGet, '/api/clients');

    test('should not return another user\'s client', async () => {
      const res = await authedGet(`/api/clients/${clientId}`, OTHER_EMAIL);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/clients/:id', () => {
    test('should update client fields', async () => {
      const res = await authedPut(`/api/clients/${clientId}`, { name: 'Acme Corp Updated', department: 'Sales' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Client updated successfully');
      expect(res.body.client.name).toBe('Acme Corp Updated');
      expect(res.body.client.department).toBe('Sales');
    });

    addIdErrorTests(authedPut, '/api/clients', { name: 'Test' });

    test('should return 400 when no fields provided', async () => {
      const res = await authedPut(`/api/clients/${clientId}`, {});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    test('should not allow another user to update client', async () => {
      const res = await authedPut(`/api/clients/${clientId}`, { name: 'Hijacked' }, OTHER_EMAIL);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/clients/:id', () => {
    test('should delete a specific client', async () => {
      const res = await authedDelete(`/api/clients/${secondClientId}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Client deleted successfully');

      const check = await authedGet(`/api/clients/${secondClientId}`);
      expect(check.status).toBe(404);
    });

    addIdErrorTests(authedDelete, '/api/clients');
  });
});

// ─── Work Entry Endpoints ────────────────────────────────────────────────────

describe('Work Entries - /api/work-entries', () => {
  let clientId;
  let secondClientId;
  let entryId;
  let secondEntryId;

  beforeAll(async () => {
    clientId = await createClient('Work Client A');
    secondClientId = await createClient('Work Client B');
  });

  describe('POST /api/work-entries', () => {
    test('should create a work entry', async () => {
      const res = await createWorkEntry(clientId, 4.5, '2025-01-15', 'Backend development');
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Work entry created successfully');
      expect(res.body.workEntry.hours).toBe(4.5);
      expect(res.body.workEntry.client_name).toBe('Work Client A');
      entryId = res.body.workEntry.id;
    });

    test('should create a second work entry for a different client', async () => {
      const res = await createWorkEntry(secondClientId, 2, '2025-01-16', 'Code review');
      expect(res.status).toBe(201);
      secondEntryId = res.body.workEntry.id;
    });

    test('should create a work entry without description', async () => {
      const res = await createWorkEntry(clientId, 1, '2025-01-17');
      expect(res.status).toBe(201);
    });

    test('should return 400 for missing required fields', async () => {
      const res = await authedPost('/api/work-entries', { description: 'No hours or client' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    test('should return 400 for invalid hours (> 24)', async () => {
      const res = await authedPost('/api/work-entries', { clientId, hours: 25, date: '2025-01-15' });
      expect(res.status).toBe(400);
    });

    test('should return 400 for non-existent client', async () => {
      const res = await authedPost('/api/work-entries', { clientId: 99999, hours: 1, date: '2025-01-15' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Client not found or does not belong to user');
    });

    test('should return 401 without auth header', async () => {
      const res = await request(app).post('/api/work-entries').send({ clientId, hours: 1, date: '2025-01-15' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/work-entries', () => {
    test('should list all work entries for the user', async () => {
      const res = await authedGet('/api/work-entries');
      expect(res.status).toBe(200);
      expect(res.body.workEntries.length).toBeGreaterThanOrEqual(3);
    });

    test('should filter work entries by clientId', async () => {
      const res = await authedGet(`/api/work-entries?clientId=${clientId}`);
      expect(res.status).toBe(200);
      res.body.workEntries.forEach(entry => {
        expect(entry.client_id).toBe(clientId);
      });
    });

    test('should return 400 for invalid clientId query param', async () => {
      const res = await authedGet('/api/work-entries?clientId=abc');
      expect(res.status).toBe(400);
    });

    test('should isolate work entries by user', async () => {
      const res = await authedGet('/api/work-entries', OTHER_EMAIL);
      expect(res.status).toBe(200);
      expect(res.body.workEntries).toEqual([]);
    });
  });

  describe('GET /api/work-entries/:id', () => {
    test('should return a specific work entry', async () => {
      const res = await authedGet(`/api/work-entries/${entryId}`);
      expect(res.status).toBe(200);
      expect(res.body.workEntry.id).toBe(entryId);
      expect(res.body.workEntry.hours).toBe(4.5);
      expect(res.body.workEntry.client_name).toBe('Work Client A');
    });

    addIdErrorTests(authedGet, '/api/work-entries');

    test('should not return another user\'s entry', async () => {
      const res = await authedGet(`/api/work-entries/${entryId}`, OTHER_EMAIL);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/work-entries/:id', () => {
    test('should update work entry fields', async () => {
      const res = await authedPut(`/api/work-entries/${entryId}`, { hours: 6, description: 'Updated work' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Work entry updated successfully');
      expect(res.body.workEntry.hours).toBe(6);
      expect(res.body.workEntry.description).toBe('Updated work');
    });

    test('should update work entry client assignment', async () => {
      const res = await authedPut(`/api/work-entries/${entryId}`, { clientId: secondClientId });
      expect(res.status).toBe(200);
      expect(res.body.workEntry.client_id).toBe(secondClientId);
      expect(res.body.workEntry.client_name).toBe('Work Client B');
      // Reassign back
      await authedPut(`/api/work-entries/${entryId}`, { clientId });
    });

    addIdErrorTests(authedPut, '/api/work-entries', { hours: 1 });

    test('should return 400 when no fields provided', async () => {
      const res = await authedPut(`/api/work-entries/${entryId}`, {});
      expect(res.status).toBe(400);
    });

    test('should return 400 for assigning to non-existent client', async () => {
      const res = await authedPut(`/api/work-entries/${entryId}`, { clientId: 99999 });
      expect(res.status).toBe(400);
    });

    test('should not allow another user to update entry', async () => {
      const res = await authedPut(`/api/work-entries/${entryId}`, { hours: 1 }, OTHER_EMAIL);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/work-entries/:id', () => {
    test('should delete a work entry', async () => {
      const res = await authedDelete(`/api/work-entries/${secondEntryId}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Work entry deleted successfully');

      const check = await authedGet(`/api/work-entries/${secondEntryId}`);
      expect(check.status).toBe(404);
    });

    addIdErrorTests(authedDelete, '/api/work-entries');

    test('should not allow another user to delete entry', async () => {
      const res = await authedDelete(`/api/work-entries/${entryId}`, OTHER_EMAIL);
      expect(res.status).toBe(404);
    });
  });
});

// ─── Report Endpoints ────────────────────────────────────────────────────────

describe('Reports - /api/reports', () => {
  let clientId;

  beforeAll(async () => {
    clientId = await createClient('Report Client');
    await createWorkEntry(clientId, 3, '2025-02-01', 'Design work');
    await createWorkEntry(clientId, 5, '2025-02-02', 'Implementation');
  });

  describe('GET /api/reports/client/:clientId', () => {
    test('should return hourly report with totals', async () => {
      const res = await authedGet(`/api/reports/client/${clientId}`);
      expect(res.status).toBe(200);
      expect(res.body.client.name).toBe('Report Client');
      expect(res.body.totalHours).toBe(8);
      expect(res.body.entryCount).toBe(2);
      expect(res.body.workEntries).toHaveLength(2);
    });

    addIdErrorTests(authedGet, '/api/reports/client');

    test('should not return report for another user\'s client', async () => {
      const res = await authedGet(`/api/reports/client/${clientId}`, OTHER_EMAIL);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/reports/export/csv/:clientId', () => {
    test('should export CSV file', async () => {
      const res = await authedGet(`/api/reports/export/csv/${clientId}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv|application\/octet-stream/);
      const body = res.text || res.body.toString();
      expect(body).toContain('Date');
      expect(body).toContain('Hours');
    });

    addIdErrorTests(authedGet, '/api/reports/export/csv');
  });

  describe('GET /api/reports/export/pdf/:clientId', () => {
    test('should export PDF file', async () => {
      const res = await authedGet(`/api/reports/export/pdf/${clientId}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/attachment.*\.pdf/);
      expect(res.body.length).toBeGreaterThan(0);
    });

    addIdErrorTests(authedGet, '/api/reports/export/pdf');
  });
});

// ─── Delete All Clients ──────────────────────────────────────────────────────

describe('DELETE /api/clients (bulk delete)', () => {
  const email = 'bulk-delete@example.com';

  beforeAll(async () => {
    await login(email);
    await authedPost('/api/clients', { name: 'Bulk A' }, email);
    await authedPost('/api/clients', { name: 'Bulk B' }, email);
  });

  test('should delete all clients for the user', async () => {
    const res = await authedDelete('/api/clients', email);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('All clients deleted successfully');
    expect(res.body.deletedCount).toBe(2);

    const list = await authedGet('/api/clients', email);
    expect(list.body.clients).toEqual([]);
  });
});

// ─── Cascade Delete ──────────────────────────────────────────────────────────

describe('Cascade delete - deleting client removes its work entries', () => {
  test('work entries should be removed when client is deleted', async () => {
    const email = 'cascade-test@example.com';
    await login(email);

    const cid = await createClient('Cascade Client', email);
    await createWorkEntry(cid, 2, '2025-03-01', null, email);

    const before = await authedGet('/api/work-entries', email);
    expect(before.body.workEntries).toHaveLength(1);

    await authedDelete(`/api/clients/${cid}`, email);

    const after = await authedGet('/api/work-entries', email);
    expect(after.body.workEntries).toHaveLength(0);
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
