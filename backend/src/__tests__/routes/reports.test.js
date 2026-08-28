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

  describe('CSV Export Download Handling', () => {
    let downloadApp;

    beforeEach(() => {
      downloadApp = express();
      downloadApp.use(express.json());
      downloadApp.use((req, res, next) => {
        res.download = jest.fn((filePath, fileName, callback) => {
          res.set('Content-Type', 'text/csv');
          res.set('Content-Disposition', `attachment; filename="${fileName}"`);
          res.status(200).send('csv data');
          if (callback) callback(null);
        });
        next();
      });
      downloadApp.use('/api/reports', reportRoutes);
    });

    test('should successfully download CSV and clean up temp file', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { date: '2024-01-01', hours: 5, description: 'Work 1', created_at: '2024-01-01' }
        ]);
      });

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockResolvedValue(undefined)
      });

      const response = await request(downloadApp).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      expect(fs.unlink).toHaveBeenCalled();
    });

    test('should handle download error and still clean up', async () => {
      const errorApp = express();
      errorApp.use(express.json());
      errorApp.use((req, res, next) => {
        res.download = jest.fn((filePath, fileName, callback) => {
          res.status(200).send('');
          if (callback) callback(new Error('Download failed'));
        });
        next();
      });
      errorApp.use('/api/reports', reportRoutes);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { date: '2024-01-01', hours: 5, description: 'Work 1', created_at: '2024-01-01' }
        ]);
      });

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockResolvedValue(undefined)
      });

      const response = await request(errorApp).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      expect(fs.unlink).toHaveBeenCalled();
    });

    test('should handle fs.unlink error during cleanup', async () => {
      fs.unlink.mockImplementation((path, callback) => callback(new Error('Unlink failed')));

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { date: '2024-01-01', hours: 5, description: 'Work 1', created_at: '2024-01-01' }
        ]);
      });

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockResolvedValue(undefined)
      });

      const response = await request(downloadApp).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
    });
  });

  describe('PDF Export Generation', () => {
    test('should generate PDF with work entries', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 100
      };
      PDFDocument.mockImplementation(() => mockDoc);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { hours: 5, description: 'Work 1', date: '2024-01-01', created_at: '2024-01-01' },
          { hours: 3, description: 'Work 2', date: '2024-01-02', created_at: '2024-01-02' }
        ]);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(200);
      expect(mockDoc.pipe).toHaveBeenCalled();
      expect(mockDoc.end).toHaveBeenCalled();
      expect(mockDoc.fontSize).toHaveBeenCalledWith(20);
    });

    test('should handle entry with no description in PDF', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 100
      };
      PDFDocument.mockImplementation(() => mockDoc);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { hours: 5, description: null, date: '2024-01-01', created_at: '2024-01-01' }
        ]);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(200);
      expect(mockDoc.text).toHaveBeenCalledWith('No description', 230, 100, { width: 300 });
    });

    test('should add page break when y exceeds 700', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 750
      };
      PDFDocument.mockImplementation(() => mockDoc);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { hours: 5, description: 'Work 1', date: '2024-01-01', created_at: '2024-01-01' }
        ]);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(200);
      expect(mockDoc.addPage).toHaveBeenCalled();
    });

    test('should add separator after every 5 entries', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 100
      };
      PDFDocument.mockImplementation(() => mockDoc);

      const entries = Array.from({ length: 6 }, (_, i) => ({
        hours: i + 1,
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
      expect(mockDoc.moveTo.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    test('should generate PDF with empty work entries', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 100
      };
      PDFDocument.mockImplementation(() => mockDoc);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(200);
      expect(mockDoc.pipe).toHaveBeenCalled();
      expect(mockDoc.end).toHaveBeenCalled();
    });
  });

  describe('Mutation Testing - SQL Query and Parameter Verification', () => {
    test('GET /client/:clientId should verify client with correct SQL and params', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 3, name: 'Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      await request(app).get('/api/reports/client/3');

      const clientQuery = mockDb.get.mock.calls[0][0];
      const clientParams = mockDb.get.mock.calls[0][1];
      expect(clientQuery).toContain('SELECT id, name FROM clients');
      expect(clientQuery).toContain('WHERE id = ?');
      expect(clientQuery).toContain('user_email');
      expect(clientParams).toEqual([3, 'test@example.com']);
    });

    test('GET /client/:clientId should query work_entries with correct SQL and params', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 3, name: 'Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ id: 1, hours: 5, description: 'Work', date: '2024-01-01' }]);
      });

      await request(app).get('/api/reports/client/3');

      const entriesQuery = mockDb.all.mock.calls[0][0];
      const entriesParams = mockDb.all.mock.calls[0][1];
      expect(entriesQuery).toContain('FROM work_entries');
      expect(entriesQuery).toContain('WHERE client_id = ?');
      expect(entriesQuery).toContain('user_email');
      expect(entriesQuery).toContain('ORDER BY date DESC');
      expect(entriesQuery).toContain('hours');
      expect(entriesQuery).toContain('description');
      expect(entriesParams).toEqual([3, 'test@example.com']);
    });

    test('GET /client/:clientId should calculate totalHours correctly', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { hours: 2.5, description: 'A', date: '2024-01-01' },
          { hours: 3.5, description: 'B', date: '2024-01-02' }
        ]);
      });

      const response = await request(app).get('/api/reports/client/1');

      expect(response.body.totalHours).toBe(6);
      expect(response.body.entryCount).toBe(2);
      expect(response.body.client).toEqual({ id: 1, name: 'Client' });
      expect(response.body.workEntries).toHaveLength(2);
    });

    test('GET /export/csv/:clientId should verify client with correct params', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 4, name: 'CSV Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockRejectedValue(new Error('fail'))
      });

      await request(app).get('/api/reports/export/csv/4');

      const clientParams = mockDb.get.mock.calls[0][1];
      expect(clientParams).toEqual([4, 'test@example.com']);

      const entriesParams = mockDb.all.mock.calls[0][1];
      expect(entriesParams).toEqual([4, 'test@example.com']);
    });

    test('GET /export/csv/:clientId should query work_entries with correct columns', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockRejectedValue(new Error('fail'))
      });

      await request(app).get('/api/reports/export/csv/1');

      const entriesQuery = mockDb.all.mock.calls[0][0];
      expect(entriesQuery).toContain('hours');
      expect(entriesQuery).toContain('description');
      expect(entriesQuery).toContain('date');
      expect(entriesQuery).toContain('created_at');
      expect(entriesQuery).toContain('FROM work_entries');
      expect(entriesQuery).toContain('WHERE client_id = ?');
      expect(entriesQuery).toContain('user_email');
      expect(entriesQuery).toContain('ORDER BY date DESC');
    });

    test('GET /export/pdf/:clientId should verify client with correct params', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 100
      };
      PDFDocument.mockImplementation(() => mockDoc);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 5, name: 'PDF Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      await request(app).get('/api/reports/export/pdf/5');

      const clientQuery = mockDb.get.mock.calls[0][0];
      const clientParams = mockDb.get.mock.calls[0][1];
      expect(clientQuery).toContain('SELECT id, name FROM clients');
      expect(clientQuery).toContain('WHERE id = ?');
      expect(clientQuery).toContain('user_email');
      expect(clientParams).toEqual([5, 'test@example.com']);

      const entriesQuery = mockDb.all.mock.calls[0][0];
      const entriesParams = mockDb.all.mock.calls[0][1];
      expect(entriesQuery).toContain('FROM work_entries');
      expect(entriesQuery).toContain('WHERE client_id = ?');
      expect(entriesQuery).toContain('user_email');
      expect(entriesParams).toEqual([5, 'test@example.com']);
    });

    test('GET /export/pdf/:clientId should set correct response headers', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 100
      };
      PDFDocument.mockImplementation(() => mockDoc);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('Test_Client');
      expect(response.headers['content-disposition']).toContain('.pdf');
    });

    test('GET /export/pdf should render client name, total hours, and entry count', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 100
      };
      PDFDocument.mockImplementation(() => mockDoc);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Acme Corp' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { hours: 3, description: 'Dev', date: '2024-01-01', created_at: '2024-01-01' },
          { hours: 5, description: 'Test', date: '2024-01-02', created_at: '2024-01-02' }
        ]);
      });

      await request(app).get('/api/reports/export/pdf/1');

      const textCalls = mockDoc.text.mock.calls.map(c => c[0]);
      expect(textCalls).toContain('Time Report for Acme Corp');
      expect(textCalls).toContain('Total Hours: 8.00');
      expect(textCalls).toContain('Total Entries: 2');
      expect(textCalls).toContain('Date');
      expect(textCalls).toContain('Hours');
      expect(textCalls).toContain('Description');
      expect(textCalls).toContain('2024-01-01');
      expect(textCalls).toContain('3');
      expect(textCalls).toContain('Dev');
      expect(textCalls).toContain('2024-01-02');
      expect(textCalls).toContain('5');
      expect(textCalls).toContain('Test');
    });

    test('GET /export/pdf should use correct font sizes', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 100
      };
      PDFDocument.mockImplementation(() => mockDoc);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      await request(app).get('/api/reports/export/pdf/1');

      const fontSizeCalls = mockDoc.fontSize.mock.calls.map(c => c[0]);
      expect(fontSizeCalls).toContain(20);
      expect(fontSizeCalls).toContain(14);
      expect(fontSizeCalls).toContain(12);
    });

    test('GET /export/pdf should draw lines at correct x positions', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 100
      };
      PDFDocument.mockImplementation(() => mockDoc);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ hours: 1, description: 'A', date: '2024-01-01', created_at: '2024-01-01' }]);
      });

      await request(app).get('/api/reports/export/pdf/1');

      expect(mockDoc.moveTo).toHaveBeenCalledWith(50, 100);
      expect(mockDoc.lineTo).toHaveBeenCalledWith(550, 100);
      expect(mockDoc.stroke).toHaveBeenCalled();
    });

    test('GET /export/pdf should position text at correct x offsets', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 100
      };
      PDFDocument.mockImplementation(() => mockDoc);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ hours: 2, description: 'Work', date: '2024-03-01', created_at: '2024-03-01' }]);
      });

      await request(app).get('/api/reports/export/pdf/1');

      expect(mockDoc.text).toHaveBeenCalledWith('Date', 50, 100, { width: 100 });
      expect(mockDoc.text).toHaveBeenCalledWith('Hours', 150, 85, { width: 80 });
      expect(mockDoc.text).toHaveBeenCalledWith('Description', 230, 85, { width: 300 });
      expect(mockDoc.text).toHaveBeenCalledWith('2024-03-01', 50, 100, { width: 100 });
      expect(mockDoc.text).toHaveBeenCalledWith('2', 150, 100, { width: 80 });
      expect(mockDoc.text).toHaveBeenCalledWith('Work', 230, 100, { width: 300 });
    });

    test('GET /export/csv should configure csvWriter with correct header columns', async () => {
      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockRejectedValue(new Error('fail'))
      });

      fs.existsSync.mockReturnValue(true);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'TestClient' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ hours: 1, description: 'W', date: '2024-01-01', created_at: '2024-01-01' }]);
      });

      await request(app).get('/api/reports/export/csv/1');

      const config = csvWriter.createObjectCsvWriter.mock.calls[0][0];
      expect(config.header).toEqual([
        { id: 'date', title: 'Date' },
        { id: 'hours', title: 'Hours' },
        { id: 'description', title: 'Description' },
        { id: 'created_at', title: 'Created At' }
      ]);
      expect(config.path).toContain('temp');
      expect(config.path).toContain('TestClient');
      expect(config.path).toContain('.csv');
    });

    test('GET /export/csv should pass work entries to writeRecords', async () => {
      const csvWriter = require('csv-writer');
      const mockWriteRecords = jest.fn().mockRejectedValue(new Error('fail'));
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: mockWriteRecords
      });

      fs.existsSync.mockReturnValue(true);

      const entries = [
        { hours: 3, description: 'Work1', date: '2024-01-01', created_at: '2024-01-01' },
        { hours: 5, description: 'Work2', date: '2024-01-02', created_at: '2024-01-02' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, entries);
      });

      await request(app).get('/api/reports/export/csv/1');

      expect(mockWriteRecords).toHaveBeenCalledWith(entries);
    });

    test('GET /export/csv filename should sanitize client name', async () => {
      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockRejectedValue(new Error('fail'))
      });

      fs.existsSync.mockReturnValue(true);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Acme & Co.' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      await request(app).get('/api/reports/export/csv/1');

      const config = csvWriter.createObjectCsvWriter.mock.calls[0][0];
      expect(config.path).toContain('Acme___Co_');
      expect(config.path).toContain('_report_');
    });

    test('GET /export/pdf should use No description for null description', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 100
      };
      PDFDocument.mockImplementation(() => mockDoc);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ hours: 4, description: null, date: '2024-01-01', created_at: '2024-01-01' }]);
      });

      await request(app).get('/api/reports/export/pdf/1');

      const textCalls = mockDoc.text.mock.calls.map(c => c[0]);
      expect(textCalls).toContain('No description');
    });

    test('GET /export/pdf should add page when y > 700', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 750
      };
      PDFDocument.mockImplementation(() => mockDoc);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ hours: 1, description: 'W', date: '2024-01-01', created_at: '2024-01-01' }]);
      });

      await request(app).get('/api/reports/export/pdf/1');

      expect(mockDoc.addPage).toHaveBeenCalled();
    });

    test('GET /export/pdf should add separator line every 5 entries', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 100
      };
      PDFDocument.mockImplementation(() => mockDoc);

      const entries = Array.from({ length: 6 }, (_, i) => ({
        hours: 1, description: `Entry ${i}`, date: '2024-01-01', created_at: '2024-01-01'
      }));

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, entries);
      });

      await request(app).get('/api/reports/export/pdf/1');

      const moveToCallCount = mockDoc.moveTo.mock.calls.length;
      expect(moveToCallCount).toBeGreaterThanOrEqual(2);
    });

    test('GET /export/pdf filename should contain sanitized client name and .pdf', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 100
      };
      PDFDocument.mockImplementation(() => mockDoc);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Acme & Co.' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.headers['content-disposition']).toContain('Acme___Co_');
      expect(response.headers['content-disposition']).toContain('_report_');
      expect(response.headers['content-disposition']).toContain('.pdf');
    });

    test('GET /client/:clientId error messages should be exact', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(new Error('DB error'), null);
      });

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    test('GET /export/csv error messages should be exact', async () => {
      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockRejectedValue(new Error('Write failed'))
      });

      fs.existsSync.mockReturnValue(true);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to generate CSV report');
    });

    test('GET /export/pdf error messages for DB errors should be exact', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('err'), null);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    test('GET /export/pdf work entries DB error should return exact message', async () => {
      const PDFDocument = require('pdfkit');
      let pipedStream = null;
      const mockDoc = {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        pipe: jest.fn((writable) => { pipedStream = writable; }),
        end: jest.fn(() => { if (pipedStream) pipedStream.end(); }),
        y: 100
      };
      PDFDocument.mockImplementation(() => mockDoc);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(new Error('err'), null);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });
});
