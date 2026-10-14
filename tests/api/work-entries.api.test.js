const { setupTestApp } = require('../helpers/test-server');
const { TestApiClient } = require('../helpers/api-client');
const { users, clients, workEntries } = require('../fixtures/test-data');

describe('Work Entries API', () => {
  let app;
  let api;
  let clientId;

  beforeAll(async () => {
    app = await setupTestApp();
    api = new TestApiClient(app, users.primary.email);
    await api.login();

    const res = await api.createClient(clients.acme);
    clientId = res.body.client.id;
  });

  describe('POST /api/work-entries', () => {
    it('should create a work entry', async () => {
      const entry = { ...workEntries.standard, clientId };
      const res = await api.createWorkEntry(entry);

      expect(res.status).toBe(201);
      expect(res.body.workEntry.hours).toBe(8);
      expect(res.body.workEntry.client_id).toBe(clientId);
      expect(res.body.workEntry.client_name).toBe(clients.acme.name);
    });

    it('should create a work entry with minimal fields', async () => {
      const entry = { ...workEntries.minimal, clientId };
      const res = await api.createWorkEntry(entry);

      expect(res.status).toBe(201);
      expect(res.body.workEntry.hours).toBe(1);
    });

    it('should reject a work entry without clientId', async () => {
      const res = await api.createWorkEntry({
        hours: 5,
        date: '2025-01-15',
      });
      expect(res.status).toBe(400);
    });

    it('should reject hours > 24', async () => {
      const res = await api.createWorkEntry({
        clientId,
        hours: 25,
        date: '2025-01-15',
      });
      expect(res.status).toBe(400);
    });

    it('should reject a work entry for a non-existent client', async () => {
      const res = await api.createWorkEntry({
        clientId: 99999,
        hours: 4,
        date: '2025-01-15',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/work-entries', () => {
    it('should list all work entries', async () => {
      const res = await api.getWorkEntries();

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.workEntries)).toBe(true);
      expect(res.body.workEntries.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter work entries by clientId', async () => {
      const res = await api.getWorkEntries(clientId);

      expect(res.status).toBe(200);
      res.body.workEntries.forEach((entry) => {
        expect(entry.client_id).toBe(clientId);
      });
    });

    it('should not return entries from a different user', async () => {
      const otherApi = api.as(users.secondary.email);
      await otherApi.login();

      const res = await otherApi.getWorkEntries();

      expect(res.status).toBe(200);
      expect(res.body.workEntries.length).toBe(0);
    });
  });

  describe('GET /api/work-entries/:id', () => {
    it('should get a specific work entry', async () => {
      const created = await api.createWorkEntry({
        clientId,
        ...workEntries.halfDay,
      });
      const entryId = created.body.workEntry.id;

      const res = await api.getWorkEntry(entryId);

      expect(res.status).toBe(200);
      expect(res.body.workEntry.id).toBe(entryId);
      expect(res.body.workEntry.hours).toBe(workEntries.halfDay.hours);
    });

    it('should return 404 for non-existent entry', async () => {
      const res = await api.getWorkEntry(99999);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/work-entries/:id', () => {
    it('should update a work entry', async () => {
      const created = await api.createWorkEntry({
        clientId,
        hours: 3,
        date: '2025-02-01',
      });
      const entryId = created.body.workEntry.id;

      const res = await api.updateWorkEntry(entryId, { hours: 6 });

      expect(res.status).toBe(200);
      expect(res.body.workEntry.hours).toBe(6);
    });

    it('should return 404 for non-existent entry', async () => {
      const res = await api.updateWorkEntry(99999, { hours: 2 });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/work-entries/:id', () => {
    it('should delete a work entry', async () => {
      const created = await api.createWorkEntry({
        clientId,
        hours: 2,
        date: '2025-03-01',
      });
      const entryId = created.body.workEntry.id;

      const res = await api.deleteWorkEntry(entryId);
      expect(res.status).toBe(200);

      const getRes = await api.getWorkEntry(entryId);
      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent entry', async () => {
      const res = await api.deleteWorkEntry(99999);
      expect(res.status).toBe(404);
    });
  });
});
