const { setupTestApp } = require('../helpers/test-server');
const { TestApiClient } = require('../helpers/api-client');
const { users, clients } = require('../fixtures/test-data');

describe('Clients API', () => {
  let app;
  let api;

  beforeAll(async () => {
    app = await setupTestApp();
    api = new TestApiClient(app, users.primary.email);
    // Register the user first
    await api.login();
  });

  describe('POST /api/clients', () => {
    it('should create a client with all fields', async () => {
      const res = await api.createClient(clients.acme);

      expect(res.status).toBe(201);
      expect(res.body.client).toMatchObject({
        name: clients.acme.name,
        description: clients.acme.description,
        department: clients.acme.department,
        email: clients.acme.email,
      });
      expect(res.body.client.id).toBeDefined();
    });

    it('should create a client with only required fields', async () => {
      const res = await api.createClient(clients.minimal);

      expect(res.status).toBe(201);
      expect(res.body.client.name).toBe(clients.minimal.name);
    });

    it('should reject a client with no name', async () => {
      const res = await api.createClient({ description: 'No name' });
      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const request = require('supertest');
      const res = await request(app)
        .post('/api/clients')
        .send(clients.acme);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/clients', () => {
    it('should list all clients for authenticated user', async () => {
      const res = await api.getClients();

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.clients)).toBe(true);
      expect(res.body.clients.length).toBeGreaterThanOrEqual(2);
    });

    it('should not return clients from a different user', async () => {
      const otherApi = api.as(users.secondary.email);
      await otherApi.login();

      const res = await otherApi.getClients();

      expect(res.status).toBe(200);
      expect(res.body.clients.length).toBe(0);
    });
  });

  describe('GET /api/clients/:id', () => {
    it('should get a specific client', async () => {
      const created = await api.createClient(clients.globex);
      const clientId = created.body.client.id;

      const res = await api.getClient(clientId);

      expect(res.status).toBe(200);
      expect(res.body.client.name).toBe(clients.globex.name);
    });

    it('should return 404 for non-existent client', async () => {
      const res = await api.getClient(99999);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid ID', async () => {
      const res = await api.getClient('abc');
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/clients/:id', () => {
    it('should update a client', async () => {
      const created = await api.createClient({ name: 'Old Name' });
      const clientId = created.body.client.id;

      const res = await api.updateClient(clientId, { name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.client.name).toBe('New Name');
    });

    it('should return 404 when updating non-existent client', async () => {
      const res = await api.updateClient(99999, { name: 'Nope' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/clients/:id', () => {
    it('should delete a client', async () => {
      const created = await api.createClient({ name: 'ToDelete' });
      const clientId = created.body.client.id;

      const res = await api.deleteClient(clientId);
      expect(res.status).toBe(200);

      const getRes = await api.getClient(clientId);
      expect(getRes.status).toBe(404);
    });

    it('should return 404 when deleting non-existent client', async () => {
      const res = await api.deleteClient(99999);
      expect(res.status).toBe(404);
    });
  });
});
