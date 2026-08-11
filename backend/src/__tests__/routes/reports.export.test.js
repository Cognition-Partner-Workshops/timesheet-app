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

const tempDir = path.join(__dirname, '../../../temp');

// These tests exercise the real csv-writer, pdfkit and fs modules so that the
// file generation and streaming paths are covered end to end.
describe('Report Export Routes (real file generation)', () => {
  let mockDb;
  let consoleErrorSpy;

  const mockClient = { id: 1, name: 'Acme Corp' };

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    mockDb = {
      all: jest.fn(),
      get: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);

    mockDb.get.mockImplementation((query, params, callback) => {
      callback(null, mockClient);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('GET /api/reports/export/csv/:clientId', () => {
    test('should stream a CSV file and clean up the temp file', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { date: '2024-01-02', hours: 3, description: 'Work 2', created_at: '2024-01-02' },
          { date: '2024-01-01', hours: 5.5, description: 'Work 1', created_at: '2024-01-01' }
        ]);
      });

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('Acme_Corp_report_');
      expect(response.text).toContain('Date,Hours,Description,Created At');
      expect(response.text).toContain('2024-01-01,5.5,Work 1');

      // Temp file is removed once the download completes
      const leftovers = fs.existsSync(tempDir) ? fs.readdirSync(tempDir) : [];
      expect(leftovers.filter(file => file.endsWith('.csv'))).toEqual([]);
    });

    test('should create the temp directory when it does not exist', async () => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      expect(fs.existsSync(tempDir)).toBe(true);
    });

    test('should sanitize client names containing unsafe characters', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 2, name: 'A/B: Corp & Sons' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/csv/2');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('A_B__Corp___Sons_report_');
    });

    test('should produce a header-only CSV when there are no entries', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      expect(response.text.trim()).toBe('Date,Hours,Description,Created At');
    });
  });

  describe('GET /api/reports/export/pdf/:clientId', () => {
    test('should stream a PDF document with report headers', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { date: '2024-01-01', hours: 5.5, description: 'Work 1', created_at: '2024-01-01' },
          { date: '2024-01-02', hours: 2.25, description: 'Work 2', created_at: '2024-01-02' }
        ]);
      });

      const response = await request(app)
        .get('/api/reports/export/pdf/1')
        .buffer()
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('Acme_Corp_report_');
      expect(response.body.slice(0, 4).toString()).toBe('%PDF');
    });

    test('should paginate and render entries without descriptions', async () => {
      const entries = Array.from({ length: 60 }, (_, index) => ({
        date: `2024-02-${String((index % 28) + 1).padStart(2, '0')}`,
        hours: index % 24,
        description: index % 2 === 0 ? `Work ${index}` : null,
        created_at: '2024-02-01'
      }));

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, entries);
      });

      const response = await request(app)
        .get('/api/reports/export/pdf/1')
        .buffer()
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(response.body.slice(0, 4).toString()).toBe('%PDF');

      // 60 entries force at least one doc.addPage() (the y > 700 branch),
      // so the rendered document must span multiple pages. PDFKit records the
      // total page count as "/Count N" in the page-tree object.
      const pdfText = response.body.toString('latin1');
      const countMatch = pdfText.match(/\/Count (\d+)/);
      expect(countMatch).not.toBeNull();
      expect(Number(countMatch[1])).toBeGreaterThan(1);
    });

    test('should generate a PDF for a client with no entries', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app)
        .get('/api/reports/export/pdf/1')
        .buffer()
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(response.body.slice(0, 4).toString()).toBe('%PDF');
    });
  });
});
