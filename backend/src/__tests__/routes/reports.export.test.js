const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../../database/init');

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

const TEMP_DIR = path.join(__dirname, '../../../temp');

/** Waits for an eventually-true condition, e.g. the asynchronous temp file cleanup. */
async function waitUntil(condition, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('Condition was not met before the timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * These tests exercise the export endpoints end to end with the real csv-writer,
 * pdfkit and fs, so the file generation and download paths are actually run.
 */
describe('Report Export Routes (real file generation)', () => {
  let mockDb;
  let consoleErrorSpy;

  const givenClientWithEntries = (client, workEntries) => {
    mockDb.get.mockImplementation((query, params, callback) => callback(null, client));
    mockDb.all.mockImplementation((query, params, callback) => callback(null, workEntries));
  };

  beforeEach(() => {
    mockDb = { all: jest.fn(), get: jest.fn() };
    getDatabase.mockReturnValue(mockDb);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('GET /api/reports/export/csv/:clientId', () => {
    test('should stream a CSV file and clean up the temp file', async () => {
      givenClientWithEntries({ id: 1, name: 'Acme Corp' }, [
        { date: '2024-01-02', hours: 3, description: 'Work 2', created_at: '2024-01-02' },
        { date: '2024-01-01', hours: 5.5, description: 'Work 1', created_at: '2024-01-01' }
      ]);

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toMatch(/attachment; filename="Acme_Corp_report_.*\.csv"/);
      expect(response.text).toContain('Date,Hours,Description,Created At');
      expect(response.text).toContain('2024-01-01,5.5,Work 1');
      await waitUntil(() => !fs.existsSync(TEMP_DIR) || fs.readdirSync(TEMP_DIR).length === 0);
    });

    test('should export a header-only CSV for a client with no work entries', async () => {
      givenClientWithEntries({ id: 2, name: 'Empty Client' }, []);

      const response = await request(app).get('/api/reports/export/csv/2');

      expect(response.status).toBe(200);
      expect(response.text.trim()).toBe('Date,Hours,Description,Created At');
    });

    test('should sanitize client names containing path and shell characters', async () => {
      givenClientWithEntries({ id: 3, name: '../../etc/passwd & co' }, []);

      const response = await request(app).get('/api/reports/export/csv/3');

      expect(response.status).toBe(200);
      const filename = response.headers['content-disposition'].match(/filename="(.+)"/)[1];
      expect(filename).toMatch(/^_+etc_passwd___co_report_[\d-]+T[\d-]+Z\.csv$/);
      expect(filename).not.toContain('/');
    });

    test('should log but not fail the request when the temp file cannot be deleted', async () => {
      givenClientWithEntries({ id: 1, name: 'Acme Corp' }, []);
      const unlinkSpy = jest.spyOn(fs, 'unlink')
        .mockImplementation((file, callback) => callback(new Error('EACCES')));

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      await waitUntil(() => consoleErrorSpy.mock.calls.some(([message]) => message === 'Error deleting temp file:'));
      unlinkSpy.mockRestore();
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    });

    test('should create the temp directory when it is missing', async () => {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
      givenClientWithEntries({ id: 1, name: 'Acme Corp' }, []);

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      expect(fs.existsSync(TEMP_DIR)).toBe(true);
    });
  });

  describe('GET /api/reports/export/pdf/:clientId', () => {
    const pdfRequest = (clientId) =>
      request(app).get(`/api/reports/export/pdf/${clientId}`).buffer().parse((res, callback) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    test('should render a PDF document for a client with entries', async () => {
      givenClientWithEntries({ id: 1, name: 'Acme Corp' }, [
        { date: '2024-01-01', hours: 5.5, description: 'Work 1', created_at: '2024-01-01' },
        { date: '2024-01-02', hours: 2.5, description: null, created_at: '2024-01-02' }
      ]);

      const response = await pdfRequest(1);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toMatch(/attachment; filename="Acme_Corp_report_.*\.pdf"/);
      expect(response.body.subarray(0, 4).toString()).toBe('%PDF');
    });

    test('should render a PDF for a client with no entries', async () => {
      givenClientWithEntries({ id: 2, name: 'Empty Client' }, []);

      const response = await pdfRequest(2);

      expect(response.status).toBe(200);
      expect(response.body.subarray(0, 4).toString()).toBe('%PDF');
    });

    test('should paginate and add separators for a large number of entries', async () => {
      const manyEntries = Array.from({ length: 60 }, (_, index) => ({
        date: `2024-02-${String((index % 28) + 1).padStart(2, '0')}`,
        hours: index % 24,
        description: `Entry ${index}`,
        created_at: '2024-02-01'
      }));
      givenClientWithEntries({ id: 1, name: 'Acme Corp' }, manyEntries);

      const response = await pdfRequest(1);

      expect(response.status).toBe(200);
      expect(response.body.subarray(0, 4).toString()).toBe('%PDF');
      expect(response.body.length).toBeGreaterThan(1000);
    });
  });
});
