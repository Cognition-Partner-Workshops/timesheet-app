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
  return jest.fn().mockImplementation(() => ({
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    addPage: jest.fn().mockReturnThis(),
    pipe: jest.fn(),
    end: jest.fn(),
    y: 100
  }));
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

  beforeEach(() => {
    mockDb = {
      all: jest.fn(),
      get: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
    
    // Mock fs methods
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
      const mockWorkEntries = [
        { id: 1, hours: 5.5, description: 'Work 1', date: '2024-01-01' },
        { id: 2, hours: 3.0, description: 'Work 2', date: '2024-01-02' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(200);
      expect(response.body.client).toEqual(mockClient);
      expect(response.body.workEntries).toEqual(mockWorkEntries);
      expect(response.body.totalHours).toBe(8.5);
      expect(response.body.entryCount).toBe(2);
    });

    test('should return report with zero hours for client with no entries', async () => {
      const mockClient = { id: 1, name: 'Empty Client' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(200);
      expect(response.body.totalHours).toBe(0);
      expect(response.body.entryCount).toBe(0);
    });

    test('should return 404 if client not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

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
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error when fetching work entries', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should filter work entries by user email', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });

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
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).get('/api/reports/export/csv/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
    });

    test('should handle database error when fetching client', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should handle database error when fetching work entries', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

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
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).get('/api/reports/export/pdf/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
    });

    test('should handle database error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

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

      mockDb.all.mockImplementation((query, params, callback) => {
        expect(params).toContain('test@example.com');
        callback(null, []);
      });

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
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { hours: 2.5 },
          { hours: 3.75 },
          { hours: 1.25 }
        ]);
      });

      const response = await request(app).get('/api/reports/client/1');

      expect(response.body.totalHours).toBe(7.5);
    });

    test('should handle integer hours', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { hours: 8 },
          { hours: 4 }
        ]);
      });

      const response = await request(app).get('/api/reports/client/1');

      expect(response.body.totalHours).toBe(12);
    });
  });

  describe('CSV Export Success Path', () => {
    test('should handle CSV write error', async () => {
      const mockClient = { id: 1, name: 'Test Client' };
      const mockWorkEntries = [
        { date: '2024-01-01', hours: 5, description: 'Work 1', created_at: '2024-01-01' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockRejectedValue(new Error('Write failed'))
      });

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to generate CSV report' });
    });

    test('should verify CSV export calls correct database queries', async () => {
      const mockClient = { id: 1, name: 'Test Client' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockRejectedValue(new Error('Write failed'))
      });

      await request(app).get('/api/reports/export/csv/1');

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name FROM clients'),
        expect.arrayContaining([1, 'test@example.com']),
        expect.any(Function)
      );
    });

    test('should create temp directory if it does not exist', async () => {
      const mockClient = { id: 1, name: 'Test Client' };
      const mockWorkEntries = [
        { date: '2024-01-01', hours: 5, description: 'Work 1', created_at: '2024-01-01' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      fs.existsSync.mockReturnValue(false);

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockRejectedValue(new Error('Write failed'))
      });

      await request(app).get('/api/reports/export/csv/1');

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    test('should not create temp directory if it exists', async () => {
      const mockClient = { id: 1, name: 'Test Client' };
      const mockWorkEntries = [];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      fs.existsSync.mockReturnValue(true);

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockRejectedValue(new Error('Write failed'))
      });

      await request(app).get('/api/reports/export/csv/1');

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });


  describe('PDF Export Success Path', () => {
    test('should handle database error when fetching work entries for PDF', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should verify PDF export calls correct database queries', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      await request(app).get('/api/reports/export/pdf/1');

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name FROM clients'),
        expect.arrayContaining([1, 'test@example.com']),
        expect.any(Function)
      );
    });
  });

  describe('CSV Download Success Path', () => {
    let csvSuccessApp;

    beforeEach(() => {
      csvSuccessApp = express();
      csvSuccessApp.use(express.json());
      csvSuccessApp.use((req, res, next) => {
        res.download = function(filePath, fileName, cb) {
          res.set('Content-Disposition', `attachment; filename="${fileName}"`);
          res.status(200).send('csv content');
          if (cb) cb(null);
        };
        next();
      });
      csvSuccessApp.use('/api/reports', reportRoutes);

      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should download CSV and clean up temp file', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { date: '2024-01-01', hours: 5, description: 'Work', created_at: '2024-01-01' }
        ]);
      });

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockResolvedValue(undefined)
      });

      const response = await request(csvSuccessApp).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      expect(fs.unlink).toHaveBeenCalled();
    });

    test('should log error when download fails and still clean up', async () => {
      const errApp = express();
      errApp.use(express.json());
      errApp.use((req, res, next) => {
        res.download = function(filePath, fileName, cb) {
          res.status(200).send('');
          if (cb) cb(new Error('Send failed'));
        };
        next();
      });
      errApp.use('/api/reports', reportRoutes);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockResolvedValue(undefined)
      });

      await request(errApp).get('/api/reports/export/csv/1');

      expect(console.error).toHaveBeenCalledWith('Error sending file:', expect.any(Error));
      expect(fs.unlink).toHaveBeenCalled();
    });

    test('should log error when temp file cleanup fails', async () => {
      fs.unlink = jest.fn((p, cb) => cb(new Error('Unlink failed')));

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockResolvedValue(undefined)
      });

      await request(csvSuccessApp).get('/api/reports/export/csv/1');

      expect(console.error).toHaveBeenCalledWith('Error deleting temp file:', expect.any(Error));
    });
  });

  describe('PDF Export Generation Path', () => {
    function createPdfMock(opts = {}) {
      let _res = null;
      return {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((target) => { _res = target; }),
        end: jest.fn(() => { if (_res) _res.end(Buffer.from('fake pdf')); }),
        y: opts.y !== undefined ? opts.y : 100
      };
    }

    afterEach(() => {
      const PDFDocument = require('pdfkit');
      PDFDocument.mockImplementation(() => ({
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn(),
        end: jest.fn(),
        y: 100
      }));
    });

    test('should generate and stream PDF with work entries', async () => {
      const PDFDocument = require('pdfkit');
      const mockPdf = createPdfMock();
      PDFDocument.mockImplementation(() => mockPdf);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { hours: 5.5, description: 'Dev work', date: '2024-01-01', created_at: '2024-01-01' },
          { hours: 3.0, description: 'Testing', date: '2024-01-02', created_at: '2024-01-02' }
        ]);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(PDFDocument).toHaveBeenCalled();
      expect(mockPdf.pipe).toHaveBeenCalled();
      expect(mockPdf.end).toHaveBeenCalled();
    });

    test('should generate PDF with empty entries list', async () => {
      const PDFDocument = require('pdfkit');
      const mockPdf = createPdfMock();
      PDFDocument.mockImplementation(() => mockPdf);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Empty Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(200);
      expect(mockPdf.text).toHaveBeenCalledWith('Total Hours: 0.00');
      expect(mockPdf.text).toHaveBeenCalledWith('Total Entries: 0');
    });

    test('should trigger page break when y exceeds 700', async () => {
      const PDFDocument = require('pdfkit');
      const mockPdf = createPdfMock({ y: 750 });
      PDFDocument.mockImplementation(() => mockPdf);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { hours: 2, description: 'Work', date: '2024-01-01', created_at: '2024-01-01' }
        ]);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(200);
      expect(mockPdf.addPage).toHaveBeenCalled();
    });

    test('should use fallback text for null description', async () => {
      const PDFDocument = require('pdfkit');
      const mockPdf = createPdfMock();
      PDFDocument.mockImplementation(() => mockPdf);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { hours: 2, description: null, date: '2024-01-01', created_at: '2024-01-01' }
        ]);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(200);
      expect(mockPdf.text).toHaveBeenCalledWith('No description', 230, 100, { width: 300 });
    });

    test('should add separator line every 5 entries', async () => {
      const PDFDocument = require('pdfkit');
      const mockPdf = createPdfMock();
      PDFDocument.mockImplementation(() => mockPdf);

      const entries = Array.from({ length: 6 }, (_, i) => ({
        hours: 1,
        description: `Work ${i + 1}`,
        date: `2024-01-0${i + 1}`,
        created_at: `2024-01-0${i + 1}`
      }));

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, entries);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(200);
      expect(mockPdf.moveTo.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    test('should set Content-Disposition header with sanitized client name', async () => {
      const PDFDocument = require('pdfkit');
      const mockPdf = createPdfMock();
      PDFDocument.mockImplementation(() => mockPdf);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Acme Corp' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('Acme_Corp');
    });
  });
});
