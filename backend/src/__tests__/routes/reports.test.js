const request = require('supertest');
const express = require('express');
const { getDatabase } = require('../../database/init');
const fs = require('fs');
const path = require('path');

jest.mock('../../database/init');
jest.mock('fs');
jest.mock('csv-writer', () => ({
  createObjectCsvWriter: jest.fn(() => ({
    writeRecords: jest.fn().mockResolvedValue(undefined)
  }))
}));

function mockCreatePdfDoc(yPosition = 100) {
  let pipedStream = null;
  return {
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    addPage: jest.fn().mockReturnThis(),
    pipe: jest.fn((stream) => { pipedStream = stream; }),
    end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
    y: yPosition
  };
}

jest.mock('pdfkit', () => jest.fn().mockImplementation(() => mockCreatePdfDoc()));

const reportRoutes = require('../../routes/reports');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/api/reports', reportRoutes);

const TEST_CLIENT = { id: 1, name: 'Test Client' };
const SAMPLE_ENTRY = { date: '2024-01-01', hours: 5, description: 'Work 1', created_at: '2024-01-01' };
const INTERNAL_ERROR = { error: 'Internal server error' };

describe('Report Routes', () => {
  let mockDb;

  function setupDb(clientResult, entriesResult) {
    mockDb.get.mockImplementation((q, p, cb) => cb(clientResult.err || null, clientResult.data));
    if (entriesResult) {
      mockDb.all.mockImplementation((q, p, cb) => cb(entriesResult.err || null, entriesResult.data));
    }
  }

  function setupClientWithEntries(client, entries) {
    setupDb({ data: client }, { data: entries });
  }

  function setupDbGetError() {
    setupDb({ err: new Error('Database error'), data: null });
  }

  function setupEntriesError() {
    setupDb({ data: TEST_CLIENT }, { err: new Error('Database error'), data: null });
  }

  function mockCsvWriterRejected() {
    require('csv-writer').createObjectCsvWriter.mockReturnValue({
      writeRecords: jest.fn().mockRejectedValue(new Error('Write failed'))
    });
  }

  function getLastPdfDoc() {
    return require('pdfkit').mock.results.slice(-1)[0].value;
  }

  async function requestPdf(clientId = 1) {
    const res = await request(app).get(`/api/reports/export/pdf/${clientId}`);
    return { response: res, doc: getLastPdfDoc() };
  }

  beforeEach(() => {
    mockDb = { all: jest.fn(), get: jest.fn() };
    getDatabase.mockReturnValue(mockDb);
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();
    fs.unlink = jest.fn((p, cb) => cb(null));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/reports/client/:clientId', () => {
    test('should return client report with work entries', async () => {
      const entries = [
        { id: 1, hours: 5.5, description: 'Work 1', date: '2024-01-01' },
        { id: 2, hours: 3.0, description: 'Work 2', date: '2024-01-02' }
      ];
      setupClientWithEntries(TEST_CLIENT, entries);

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(200);
      expect(response.body.client).toEqual(TEST_CLIENT);
      expect(response.body.workEntries).toEqual(entries);
      expect(response.body.totalHours).toBe(8.5);
      expect(response.body.entryCount).toBe(2);
    });

    test('should return report with zero hours for client with no entries', async () => {
      setupClientWithEntries({ id: 1, name: 'Empty Client' }, []);

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(200);
      expect(response.body.totalHours).toBe(0);
      expect(response.body.entryCount).toBe(0);
    });

    test('should return 404 if client not found', async () => {
      setupDb({ data: null });

      const response = await request(app).get('/api/reports/client/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
    });

    test('should return 400 for invalid client ID', async () => {
      const response = await request(app).get('/api/reports/client/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });

    test('should handle database error when fetching client', async () => {
      setupDbGetError();

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual(INTERNAL_ERROR);
    });

    test('should handle database error when fetching work entries', async () => {
      setupEntriesError();

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual(INTERNAL_ERROR);
    });

    test('should filter work entries by user email', async () => {
      setupDb({ data: TEST_CLIENT });
      mockDb.all.mockImplementation((query, params, callback) => {
        expect(params).toEqual([1, 'test@example.com']);
        callback(null, []);
      });

      await request(app).get('/api/reports/client/1');

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE client_id = ? AND user_email = ?'),
        [1, 'test@example.com'],
        expect.any(Function)
      );
    });
  });

  describe.each([
    ['csv', '/api/reports/export/csv'],
    ['pdf', '/api/reports/export/pdf']
  ])('GET /api/reports/export/%s/:clientId - error handling', (type, basePath) => {
    test('should return 400 for invalid client ID', async () => {
      const response = await request(app).get(`${basePath}/invalid`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });

    test('should return 404 if client not found', async () => {
      setupDb({ data: null });

      const response = await request(app).get(`${basePath}/999`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
    });

    test('should handle database error when fetching client', async () => {
      setupDbGetError();

      const response = await request(app).get(`${basePath}/1`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual(INTERNAL_ERROR);
    });

    test('should handle database error when fetching work entries', async () => {
      setupEntriesError();

      const response = await request(app).get(`${basePath}/1`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual(INTERNAL_ERROR);
    });
  });

  describe('Data Isolation', () => {
    test('should only return data for authenticated user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        expect(params).toContain('test@example.com');
        callback(null, TEST_CLIENT);
      });
      mockDb.all.mockImplementation((q, p, cb) => cb(null, []));

      await request(app).get('/api/reports/client/1');

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['test@example.com']),
        expect.any(Function)
      );
    });
  });

  describe('Hours Calculation', () => {
    test.each([
      [[{ hours: 2.5 }, { hours: 3.75 }, { hours: 1.25 }], 7.5, 'decimal hours'],
      [[{ hours: 8 }, { hours: 4 }], 12, 'integer hours']
    ])('should correctly sum %s', async (entries, expectedTotal) => {
      setupClientWithEntries(TEST_CLIENT, entries);

      const response = await request(app).get('/api/reports/client/1');

      expect(response.body.totalHours).toBe(expectedTotal);
    });
  });

  describe('CSV Export Success Path', () => {
    test('should handle CSV write error', async () => {
      setupClientWithEntries(TEST_CLIENT, [SAMPLE_ENTRY]);
      mockCsvWriterRejected();

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to generate CSV report' });
    });

    test('should verify CSV export calls correct database queries', async () => {
      setupClientWithEntries(TEST_CLIENT, []);
      mockCsvWriterRejected();

      await request(app).get('/api/reports/export/csv/1');

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name FROM clients'),
        expect.arrayContaining([1, 'test@example.com']),
        expect.any(Function)
      );
    });

    test.each([
      [false, true, 'should create temp directory if it does not exist'],
      [true, false, 'should not create temp directory if it exists']
    ])('when existsSync=%s, mkdirSync called=%s', async (exists, shouldCreate) => {
      setupClientWithEntries(TEST_CLIENT, [SAMPLE_ENTRY]);
      fs.existsSync.mockReturnValue(exists);
      mockCsvWriterRejected();

      await request(app).get('/api/reports/export/csv/1');

      if (shouldCreate) {
        expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      } else {
        expect(fs.mkdirSync).not.toHaveBeenCalled();
      }
    });
  });

  describe('PDF Export Success Path', () => {
    test('should verify PDF export calls correct database queries', async () => {
      setupEntriesError();

      await request(app).get('/api/reports/export/pdf/1');

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name FROM clients'),
        expect.arrayContaining([1, 'test@example.com']),
        expect.any(Function)
      );
    });

    test('should generate PDF with work entries and pipe to response', async () => {
      setupClientWithEntries(TEST_CLIENT, [
        { date: '2024-01-01', hours: 5, description: 'Development work', created_at: '2024-01-01' },
        { date: '2024-01-02', hours: 3.5, description: 'Code review', created_at: '2024-01-02' }
      ]);

      const { doc } = await requestPdf();

      expect(doc.pipe).toHaveBeenCalled();
      expect(doc.end).toHaveBeenCalled();
      expect(doc.fontSize).toHaveBeenCalled();
      expect(doc.text).toHaveBeenCalled();
    });

    test('should generate PDF with empty work entries', async () => {
      setupClientWithEntries({ id: 1, name: 'Empty Client' }, []);

      const { doc } = await requestPdf();

      expect(doc.pipe).toHaveBeenCalled();
      expect(doc.end).toHaveBeenCalled();
    });

    test('should generate PDF with entry having no description', async () => {
      setupClientWithEntries(TEST_CLIENT, [
        { date: '2024-01-01', hours: 2, description: null, created_at: '2024-01-01' }
      ]);

      const { doc } = await requestPdf();

      expect(doc.text).toHaveBeenCalledWith(
        'No description', expect.any(Number), expect.any(Number), expect.any(Object)
      );
    });

    test('should add separator line every 5 entries in PDF', async () => {
      const entries = Array.from({ length: 6 }, (_, i) => ({
        date: `2024-01-0${i + 1}`, hours: 2,
        description: `Work ${i + 1}`, created_at: `2024-01-0${i + 1}`
      }));
      setupClientWithEntries(TEST_CLIENT, entries);

      const { doc } = await requestPdf();

      expect(doc.moveTo).toHaveBeenCalled();
      expect(doc.lineTo).toHaveBeenCalled();
      expect(doc.stroke).toHaveBeenCalled();
    });

    test('should handle page break when y exceeds 700 in PDF', async () => {
      setupClientWithEntries(TEST_CLIENT, [
        { date: '2024-01-01', hours: 2, description: 'Work', created_at: '2024-01-01' }
      ]);

      require('pdfkit').mockImplementation(() => mockCreatePdfDoc(750));

      const { doc } = await requestPdf();

      expect(doc.addPage).toHaveBeenCalled();
    });
  });
});
