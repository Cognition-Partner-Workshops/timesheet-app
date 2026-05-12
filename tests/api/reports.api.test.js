const { setupTestApp } = require('../helpers/test-server');
const { TestApiClient } = require('../helpers/api-client');
const { users, clients, workEntries } = require('../fixtures/test-data');

describe('Reports API', () => {
  let app;
  let api;
  let clientId;

  beforeAll(async () => {
    app = await setupTestApp();
    api = new TestApiClient(app, users.primary.email);
    await api.login();

    const clientRes = await api.createClient(clients.acme);
    clientId = clientRes.body.client.id;

    // Seed a few work entries
    await api.createWorkEntry({ clientId, ...workEntries.standard });
    await api.createWorkEntry({ clientId, ...workEntries.halfDay });
  });

  describe('GET /api/reports/client/:clientId', () => {
    it('should return a report with entries and totals', async () => {
      const res = await api.getClientReport(clientId);

      expect(res.status).toBe(200);
      expect(res.body.client.name).toBe(clients.acme.name);
      expect(res.body.totalHours).toBe(
        workEntries.standard.hours + workEntries.halfDay.hours
      );
      expect(res.body.entryCount).toBe(2);
      expect(Array.isArray(res.body.workEntries)).toBe(true);
    });

    it('should return 404 for non-existent client', async () => {
      const res = await api.getClientReport(99999);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid client ID', async () => {
      const res = await api.getClientReport('abc');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/reports/export/csv/:clientId', () => {
    it('should export a CSV file', async () => {
      const res = await api.exportCsv(clientId);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/octet-stream|csv|text/);
      // CSV content should include header and data
      expect(res.text || res.body.toString()).toContain('Date');
    });

    it('should return 404 for non-existent client', async () => {
      const res = await api.exportCsv(99999);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/reports/export/pdf/:clientId', () => {
    it('should export a PDF file', async () => {
      const res = await api.exportPdf(clientId);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/octet-stream|pdf/);
      // PDF files start with %PDF
      const body = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body);
      expect(body.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('should return 404 for non-existent client', async () => {
      const res = await api.exportPdf(99999);
      expect(res.status).toBe(404);
    });
  });
});
