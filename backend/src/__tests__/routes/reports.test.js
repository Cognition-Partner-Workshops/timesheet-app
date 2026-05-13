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
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => {
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
      y: 100
    };
  });
});

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

describe('Report Routes', () => {
  let mockDb;

  function mockClientFound(client) {
    mockDb.get.mockImplementation((query, params, callback) => {
      callback(null, client);
    });
  }

  function mockClientNotFound() {
    mockDb.get.mockImplementation((query, params, callback) => {
      callback(null, null);
    });
  }

  function mockDbGetError() {
    mockDb.get.mockImplementation((query, params, callback) => {
      callback(new Error('Database error'), null);
    });
  }

  function mockWorkEntries(entries) {
    mockDb.all.mockImplementation((query, params, callback) => {
      callback(null, entries);
    });
  }

  function mockWorkEntriesError() {
    mockDb.all.mockImplementation((query, params, callback) => {
      callback(new Error('Database error'), null);
    });
  }

  function mockClientWithEntries(client, entries) {
    mockClientFound(client);
    mockWorkEntries(entries);
  }

  function mockCsvWriterRejected() {
    const csvWriter = require('csv-writer');
    csvWriter.createObjectCsvWriter.mockReturnValue({
      writeRecords: jest.fn().mockRejectedValue(new Error('Write failed'))
    });
  }

  function getLastPdfInstance() {
    const PDFDocument = require('pdfkit');
    return PDFDocument.mock.results[PDFDocument.mock.results.length - 1].value;
  }

  beforeEach(() => {
    mockDb = {
      all: jest.fn(),
      get: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
    
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();
    fs.unlink = jest.fn((path, callback) => callback(null));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/reports/client/:clientId', () => {
    test('should return client report with work entries', async () => {
      const mockClient = { id: 1, name: 'Test Client' };
      const mockEntries = [
        { id: 1, hours: 5.5, description: 'Work 1', date: '2024-01-01' },
        { id: 2, hours: 3.0, description: 'Work 2', date: '2024-01-02' }
      ];
      mockClientWithEntries(mockClient, mockEntries);

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(200);
      expect(response.body.client).toEqual(mockClient);
      expect(response.body.workEntries).toEqual(mockEntries);
      expect(response.body.totalHours).toBe(8.5);
      expect(response.body.entryCount).toBe(2);
    });

    test('should return report with zero hours for client with no entries', async () => {
      mockClientWithEntries({ id: 1, name: 'Empty Client' }, []);

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(200);
      expect(response.body.totalHours).toBe(0);
      expect(response.body.entryCount).toBe(0);
    });

    test('should return 404 if client not found', async () => {
      mockClientNotFound();

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
      mockDbGetError();

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error when fetching work entries', async () => {
      mockClientFound({ id: 1, name: 'Test Client' });
      mockWorkEntriesError();

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should filter work entries by user email', async () => {
      mockClientFound({ id: 1, name: 'Test Client' });
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

  describe('GET /api/reports/export/csv/:clientId', () => {
    test('should return 400 for invalid client ID', async () => {
      const response = await request(app).get('/api/reports/export/csv/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });

    test('should return 404 if client not found', async () => {
      mockClientNotFound();

      const response = await request(app).get('/api/reports/export/csv/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
    });

    test('should handle database error when fetching client', async () => {
      mockDbGetError();

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error when fetching work entries', async () => {
      mockClientFound({ id: 1, name: 'Test Client' });
      mockWorkEntriesError();

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/reports/export/pdf/:clientId', () => {
    test('should return 400 for invalid client ID', async () => {
      const response = await request(app).get('/api/reports/export/pdf/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });

    test('should return 404 if client not found', async () => {
      mockClientNotFound();

      const response = await request(app).get('/api/reports/export/pdf/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
    });

    test('should handle database error', async () => {
      mockDbGetError();

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('Data Isolation', () => {
    test('should only return data for authenticated user', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        expect(params).toContain('test@example.com');
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockWorkEntries([]);

      await request(app).get('/api/reports/client/1');

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['test@example.com']),
        expect.any(Function)
      );
    });
  });

  describe('Hours Calculation', () => {
    test('should correctly sum decimal hours', async () => {
      mockClientWithEntries({ id: 1, name: 'Test Client' }, [
        { hours: 2.5 }, { hours: 3.75 }, { hours: 1.25 }
      ]);

      const response = await request(app).get('/api/reports/client/1');

      expect(response.body.totalHours).toBe(7.5);
    });

    test('should handle integer hours', async () => {
      mockClientWithEntries({ id: 1, name: 'Test Client' }, [
        { hours: 8 }, { hours: 4 }
      ]);

      const response = await request(app).get('/api/reports/client/1');

      expect(response.body.totalHours).toBe(12);
    });
  });

  describe('CSV Export Success Path', () => {
    test('should handle CSV write error', async () => {
      mockClientWithEntries({ id: 1, name: 'Test Client' }, [
        { date: '2024-01-01', hours: 5, description: 'Work 1', created_at: '2024-01-01' }
      ]);
      mockCsvWriterRejected();

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to generate CSV report' });
    });

    test('should verify CSV export calls correct database queries', async () => {
      mockClientWithEntries({ id: 1, name: 'Test Client' }, []);
      mockCsvWriterRejected();

      await request(app).get('/api/reports/export/csv/1');

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name FROM clients'),
        expect.arrayContaining([1, 'test@example.com']),
        expect.any(Function)
      );
    });

    test('should create temp directory if it does not exist', async () => {
      mockClientWithEntries({ id: 1, name: 'Test Client' }, [
        { date: '2024-01-01', hours: 5, description: 'Work 1', created_at: '2024-01-01' }
      ]);
      fs.existsSync.mockReturnValue(false);
      mockCsvWriterRejected();

      await request(app).get('/api/reports/export/csv/1');

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    test('should not create temp directory if it exists', async () => {
      mockClientWithEntries({ id: 1, name: 'Test Client' }, []);
      fs.existsSync.mockReturnValue(true);
      mockCsvWriterRejected();

      await request(app).get('/api/reports/export/csv/1');

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('PDF Export Success Path', () => {
    test('should handle database error when fetching work entries for PDF', async () => {
      mockClientFound({ id: 1, name: 'Test Client' });
      mockWorkEntriesError();

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should verify PDF export calls correct database queries', async () => {
      mockClientFound({ id: 1, name: 'Test Client' });
      mockWorkEntriesError();

      await request(app).get('/api/reports/export/pdf/1');

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name FROM clients'),
        expect.arrayContaining([1, 'test@example.com']),
        expect.any(Function)
      );
    });

    test('should generate PDF with work entries and pipe to response', async () => {
      mockClientWithEntries({ id: 1, name: 'Test Client' }, [
        { date: '2024-01-01', hours: 5, description: 'Development work', created_at: '2024-01-01' },
        { date: '2024-01-02', hours: 3.5, description: 'Code review', created_at: '2024-01-02' }
      ]);

      await request(app).get('/api/reports/export/pdf/1');

      const doc = getLastPdfInstance();
      expect(doc.pipe).toHaveBeenCalled();
      expect(doc.end).toHaveBeenCalled();
      expect(doc.fontSize).toHaveBeenCalled();
      expect(doc.text).toHaveBeenCalled();
    });

    test('should generate PDF with empty work entries', async () => {
      mockClientWithEntries({ id: 1, name: 'Empty Client' }, []);

      await request(app).get('/api/reports/export/pdf/1');

      const doc = getLastPdfInstance();
      expect(doc.pipe).toHaveBeenCalled();
      expect(doc.end).toHaveBeenCalled();
    });

    test('should generate PDF with entry having no description', async () => {
      mockClientWithEntries({ id: 1, name: 'Test Client' }, [
        { date: '2024-01-01', hours: 2, description: null, created_at: '2024-01-01' }
      ]);

      await request(app).get('/api/reports/export/pdf/1');

      const doc = getLastPdfInstance();
      expect(doc.text).toHaveBeenCalledWith(
        'No description', expect.any(Number), expect.any(Number), expect.any(Object)
      );
    });

    test('should add separator line every 5 entries in PDF', async () => {
      const entries = Array.from({ length: 6 }, (_, i) => ({
        date: `2024-01-0${i + 1}`, hours: 2,
        description: `Work ${i + 1}`, created_at: `2024-01-0${i + 1}`
      }));
      mockClientWithEntries({ id: 1, name: 'Test Client' }, entries);

      await request(app).get('/api/reports/export/pdf/1');

      const doc = getLastPdfInstance();
      expect(doc.moveTo).toHaveBeenCalled();
      expect(doc.lineTo).toHaveBeenCalled();
      expect(doc.stroke).toHaveBeenCalled();
    });

    test('should handle page break when y exceeds 700 in PDF', async () => {
      mockClientWithEntries({ id: 1, name: 'Test Client' }, [
        { date: '2024-01-01', hours: 2, description: 'Work', created_at: '2024-01-01' }
      ]);

      const PDFDocument = require('pdfkit');
      PDFDocument.mockImplementation(() => {
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
          y: 750
        };
      });

      await request(app).get('/api/reports/export/pdf/1');

      const doc = getLastPdfInstance();
      expect(doc.addPage).toHaveBeenCalled();
    });
  });
});
