const request = require('supertest');
const express = require('express');
const { getDatabase } = require('../../database/init');
const fs = require('fs');
const path = require('path');

jest.mock('../../database/init');
jest.mock('fs');

// Mock csv-writer
jest.mock('csv-writer', () => ({
  createObjectCsvWriter: jest.fn(() => ({
    writeRecords: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Mock PDFKit to simulate PDF generation with proper pipe/end behavior
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => {
    let piped = null;
    return {
      fontSize: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      moveDown: jest.fn().mockReturnThis(),
      moveTo: jest.fn().mockReturnThis(),
      lineTo: jest.fn().mockReturnThis(),
      stroke: jest.fn().mockReturnThis(),
      addPage: jest.fn().mockReturnThis(),
      pipe: jest.fn(function (dest) {
        piped = dest;
      }),
      end: jest.fn(function () {
        if (piped && typeof piped.end === 'function') {
          piped.end();
        }
      }),
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

// Create app with a middleware that intercepts res.download to avoid needing real files
function createApp(downloadOverride) {
  const app = express();
  app.use(express.json());
  if (downloadOverride) {
    app.use((req, res, next) => {
      res.download = function (filePath, filename, callback) {
        // Simulate sending the file response so supertest doesn't hang
        res.status(200).send('mock-file-content');
        if (callback) {
          downloadOverride(filePath, filename, callback);
        }
      };
      next();
    });
  }
  app.use('/api/reports', reportRoutes);
  return app;
}

const defaultApp = createApp();

describe('Report Routes - Coverage Gaps', () => {
  let mockDb;

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

  describe('CSV Export - Success Path (res.download)', () => {
    test('should successfully generate and download CSV file', async () => {
      const mockClient = { id: 1, name: 'Test Client' };
      const mockWorkEntries = [
        { date: '2024-01-01', hours: 5, description: 'Work 1', created_at: '2024-01-01T00:00:00Z' },
        { date: '2024-01-02', hours: 3, description: 'Work 2', created_at: '2024-01-02T00:00:00Z' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockResolvedValue(undefined)
      });

      // Use app with download interceptor that simulates success
      const app = createApp((filePath, filename, callback) => {
        // Simulate successful download
        callback(null);
      });

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(csvWriter.createObjectCsvWriter).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalled();
    });

    test('should handle download error and still clean up temp file', async () => {
      const mockClient = { id: 1, name: 'Test Client' };
      const mockWorkEntries = [
        { date: '2024-01-01', hours: 5, description: 'Work', created_at: '2024-01-01T00:00:00Z' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockResolvedValue(undefined)
      });

      // Use app with download interceptor that simulates error
      const app = createApp((filePath, filename, callback) => {
        callback(new Error('Download failed'));
      });

      const response = await request(app).get('/api/reports/export/csv/1');

      // Unlink should still be called for cleanup
      expect(fs.unlink).toHaveBeenCalled();
    });

    test('should handle unlink error gracefully during CSV cleanup', async () => {
      const mockClient = { id: 1, name: 'Special-Client!' };
      const mockWorkEntries = [
        { date: '2024-01-01', hours: 2, description: 'Work', created_at: '2024-01-01T00:00:00Z' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      fs.unlink = jest.fn((path, callback) => callback(new Error('Unlink failed')));

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockResolvedValue(undefined)
      });

      const app = createApp((filePath, filename, callback) => {
        callback(null);
      });

      // Should not throw despite unlink error
      const response = await request(app).get('/api/reports/export/csv/1');

      expect(fs.unlink).toHaveBeenCalled();
    });

    test('should handle CSV with empty work entries', async () => {
      const mockClient = { id: 1, name: 'Empty Client' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockResolvedValue(undefined)
      });

      const app = createApp((filePath, filename, callback) => {
        callback(null);
      });

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(csvWriter.createObjectCsvWriter).toHaveBeenCalled();
    });
  });

  describe('PDF Export - Success Path (doc.pipe + doc.end)', () => {
    test('should generate PDF with work entries', async () => {
      const mockClient = { id: 1, name: 'PDF Client' };
      const mockWorkEntries = [
        { hours: 8, description: 'Full day work', date: '2024-01-15' },
        { hours: 4, description: 'Half day work', date: '2024-01-16' },
        { hours: 2, description: null, date: '2024-01-17' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const PDFDocument = require('pdfkit');

      const response = await request(defaultApp).get('/api/reports/export/pdf/1');

      expect(PDFDocument).toHaveBeenCalled();
      const mockDoc = PDFDocument.mock.results[PDFDocument.mock.results.length - 1].value;
      expect(mockDoc.pipe).toHaveBeenCalled();
      expect(mockDoc.fontSize).toHaveBeenCalled();
      expect(mockDoc.text).toHaveBeenCalled();
      expect(mockDoc.end).toHaveBeenCalled();
    });

    test('should generate PDF with empty work entries', async () => {
      const mockClient = { id: 1, name: 'Empty PDF Client' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const PDFDocument = require('pdfkit');

      const response = await request(defaultApp).get('/api/reports/export/pdf/1');

      const mockDoc = PDFDocument.mock.results[PDFDocument.mock.results.length - 1].value;
      expect(mockDoc.pipe).toHaveBeenCalled();
      expect(mockDoc.end).toHaveBeenCalled();
    });

    test('should add page break when y exceeds 700', async () => {
      const mockClient = { id: 1, name: 'Long Report Client' };
      const mockWorkEntries = [];
      for (let i = 0; i < 10; i++) {
        mockWorkEntries.push({
          hours: 2,
          description: `Work item ${i + 1}`,
          date: `2024-01-${String(i + 1).padStart(2, '0')}`
        });
      }

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const PDFDocument = require('pdfkit');
      PDFDocument.mockImplementation(() => {
        let piped = null;
        return {
          fontSize: jest.fn().mockReturnThis(),
          text: jest.fn().mockReturnThis(),
          moveDown: jest.fn().mockReturnThis(),
          moveTo: jest.fn().mockReturnThis(),
          lineTo: jest.fn().mockReturnThis(),
          stroke: jest.fn().mockReturnThis(),
          addPage: jest.fn().mockReturnThis(),
          pipe: jest.fn(function (dest) { piped = dest; }),
          end: jest.fn(function () { if (piped && piped.end) piped.end(); }),
          y: 750
        };
      });

      const response = await request(defaultApp).get('/api/reports/export/pdf/1');

      const mockDoc = PDFDocument.mock.results[PDFDocument.mock.results.length - 1].value;
      expect(mockDoc.addPage).toHaveBeenCalled();
    });

    test('should add separator lines every 5 entries', async () => {
      const mockClient = { id: 1, name: 'Separator Client' };
      const mockWorkEntries = [];
      for (let i = 0; i < 6; i++) {
        mockWorkEntries.push({
          hours: 1,
          description: `Entry ${i}`,
          date: `2024-01-${String(i + 1).padStart(2, '0')}`
        });
      }

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const PDFDocument = require('pdfkit');

      const response = await request(defaultApp).get('/api/reports/export/pdf/1');

      const mockDoc = PDFDocument.mock.results[PDFDocument.mock.results.length - 1].value;
      expect(mockDoc.moveTo).toHaveBeenCalled();
      expect(mockDoc.stroke).toHaveBeenCalled();
    });

    test('should handle entries with null description in PDF', async () => {
      const mockClient = { id: 1, name: 'Null Desc Client' };
      const mockWorkEntries = [
        { hours: 3, description: null, date: '2024-01-01' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const PDFDocument = require('pdfkit');

      const response = await request(defaultApp).get('/api/reports/export/pdf/1');

      const mockDoc = PDFDocument.mock.results[PDFDocument.mock.results.length - 1].value;
      // text should be called with 'No description' fallback
      expect(mockDoc.text).toHaveBeenCalledWith('No description', expect.any(Number), expect.any(Number), expect.any(Object));
    });
  });
});
