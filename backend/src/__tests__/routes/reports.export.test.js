const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../../database/init');

// Unlike reports.test.js, this suite exercises the real csv-writer, pdfkit and
// fs so the export success paths (file download, cleanup, PDF rendering) run
// end to end. Only the database and auth layers are mocked.
jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const reportRoutes = require('../../routes/reports');

const app = express();
app.use(express.json());
app.use('/api/reports', reportRoutes);

const tempDir = path.join(__dirname, '../../../temp');

describe('Report Export Routes (real file generation)', () => {
  let mockDb;
  let consoleErrorSpy;

  const mockClient = { id: 1, name: 'Acme Corp' };

  const mockClientLookup = (client) => {
    mockDb.get.mockImplementation((query, params, callback) => {
      callback(null, client);
    });
  };

  const mockWorkEntries = (entries) => {
    mockDb.all.mockImplementation((query, params, callback) => {
      callback(null, entries);
    });
  };

  beforeEach(() => {
    mockDb = {
      all: jest.fn(),
      get: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('GET /api/reports/export/csv/:clientId', () => {
    test('should download a CSV file with work entry rows', async () => {
      mockClientLookup(mockClient);
      mockWorkEntries([
        { date: '2024-01-02', hours: 3, description: 'Work 2', created_at: '2024-01-02T10:00:00Z' },
        { date: '2024-01-01', hours: 5.5, description: 'Work 1', created_at: '2024-01-01T10:00:00Z' }
      ]);

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('Acme_Corp_report_');
      expect(response.headers['content-disposition']).toContain('.csv');
      expect(response.text).toContain('Date,Hours,Description,Created At');
      expect(response.text).toContain('2024-01-01,5.5,Work 1');
      expect(response.text).toContain('2024-01-02,3,Work 2');
    });

    test('should download a header-only CSV when the client has no entries', async () => {
      mockClientLookup({ id: 2, name: 'Empty Client' });
      mockWorkEntries([]);

      const response = await request(app).get('/api/reports/export/csv/2');

      expect(response.status).toBe(200);
      expect(response.text.trim()).toBe('Date,Hours,Description,Created At');
    });

    test('should delete the temp file after the download completes', async () => {
      mockClientLookup(mockClient);
      mockWorkEntries([
        { date: '2024-01-01', hours: 1, description: 'Work', created_at: '2024-01-01T10:00:00Z' }
      ]);

      const response = await request(app).get('/api/reports/export/csv/1');
      const filename = /filename="(.+)"/.exec(response.headers['content-disposition'])[1];

      // The unlink callback runs after the response is flushed.
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fs.existsSync(path.join(tempDir, filename))).toBe(false);
    });

    test('should sanitize special characters in the client name', async () => {
      mockClientLookup({ id: 3, name: 'A/B & C, Inc.' });
      mockWorkEntries([]);

      const response = await request(app).get('/api/reports/export/csv/3');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('A_B___C__Inc__report_');
    });

    test('should create the temp directory when it does not exist', async () => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      mockClientLookup(mockClient);
      mockWorkEntries([]);

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      expect(fs.existsSync(tempDir)).toBe(true);
    });
  });

  describe('GET /api/reports/export/pdf/:clientId', () => {
    test('should stream a PDF document with report headers', async () => {
      mockClientLookup(mockClient);
      mockWorkEntries([
        { date: '2024-01-01', hours: 5.5, description: 'Work 1', created_at: '2024-01-01T10:00:00Z' },
        { date: '2024-01-02', hours: 2.25, description: 'Work 2', created_at: '2024-01-02T10:00:00Z' }
      ]);

      const response = await request(app)
        .get('/api/reports/export/pdf/1')
        .buffer()
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('Acme_Corp_report_');
      expect(response.body.slice(0, 5).toString()).toBe('%PDF-');
    });

    test('should generate a PDF for a client with no work entries', async () => {
      mockClientLookup({ id: 2, name: 'Empty Client' });
      mockWorkEntries([]);

      const response = await request(app)
        .get('/api/reports/export/pdf/2')
        .buffer()
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(response.body.slice(0, 5).toString()).toBe('%PDF-');
    });

    test('should paginate and render entries with missing descriptions', async () => {
      const entries = Array.from({ length: 60 }, (_, index) => ({
        date: `2024-01-${String((index % 28) + 1).padStart(2, '0')}`,
        hours: 1,
        description: index % 2 === 0 ? null : `Work ${index}`,
        created_at: '2024-01-01T10:00:00Z'
      }));

      mockClientLookup(mockClient);
      mockWorkEntries(entries);

      const response = await request(app)
        .get('/api/reports/export/pdf/1')
        .buffer()
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      // More than one page is emitted once entries overflow the first page.
      expect(response.body.toString('latin1').match(/\/Type \/Page[^s]/g).length).toBeGreaterThan(1);
    });

    test('should handle string hours values when totalling', async () => {
      mockClientLookup(mockClient);
      mockWorkEntries([
        { date: '2024-01-01', hours: '2.50', description: 'Work', created_at: '2024-01-01T10:00:00Z' }
      ]);

      const response = await request(app)
        .get('/api/reports/export/pdf/1')
        .buffer()
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(response.body.slice(0, 5).toString()).toBe('%PDF-');
    });
  });

  describe('Boundary conditions', () => {
    test.each([
      ['0', '/api/reports/export/csv/0'],
      ['negative', '/api/reports/export/csv/-1'],
      ['float', '/api/reports/export/pdf/1.9']
    ])('should parse %s client IDs before querying', async (_label, url) => {
      mockClientLookup(null);

      const response = await request(app).get(url);

      expect(response.status).toBe(404);
      expect(mockDb.get).toHaveBeenCalled();
    });

    test('should reject an empty client ID segment with 404 routing', async () => {
      const response = await request(app).get('/api/reports/export/csv/');

      expect(response.status).toBe(404);
      expect(mockDb.get).not.toHaveBeenCalled();
    });
  });
});
