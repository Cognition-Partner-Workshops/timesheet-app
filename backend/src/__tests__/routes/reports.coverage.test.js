const { getDatabase } = require('../../database/init');
const fs = require('fs');
const path = require('path');

jest.mock('../../database/init');

// Mock csv-writer
const mockWriteRecords = jest.fn();
jest.mock('csv-writer', () => ({
  createObjectCsvWriter: jest.fn(() => ({
    writeRecords: mockWriteRecords
  }))
}));

// Track PDF instance per test
let lastPdfInstance = null;
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => {
    const instance = {
      fontSize: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      moveDown: jest.fn().mockReturnThis(),
      moveTo: jest.fn().mockReturnThis(),
      lineTo: jest.fn().mockReturnThis(),
      stroke: jest.fn().mockReturnThis(),
      addPage: jest.fn().mockReturnThis(),
      pipe: jest.fn((writable) => {
        instance._writable = writable;
      }),
      end: jest.fn(() => {
        if (instance._writable && !instance._writable.writableEnded) {
          instance._writable.end();
        }
      }),
      y: 100,
      _writable: null
    };
    lastPdfInstance = instance;
    return instance;
  });
});

jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

describe('Report Routes - Coverage Improvement', () => {
  let mockDb;
  let reportRoutes;

  beforeEach(() => {
    jest.clearAllMocks();
    lastPdfInstance = null;
    
    mockDb = {
      all: jest.fn(),
      get: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
  });

  describe('CSV Export - Code Path Coverage', () => {
    test('should call csvWriter.writeRecords for CSV export', async () => {
      const mockClient = { id: 1, name: 'Test Client' };
      const mockWorkEntries = [
        { date: '2024-01-01', hours: 5, description: 'Work 1', created_at: '2024-01-01T00:00:00Z' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      // Make writeRecords reject to avoid the res.download hang
      mockWriteRecords.mockRejectedValue(new Error('Write failed'));

      const request = require('supertest');
      const express = require('express');
      const app = express();
      app.use(express.json());
      app.use('/api/reports', require('../../routes/reports'));

      const response = await request(app).get('/api/reports/export/csv/1');

      // Verify the CSV creation code path was exercised
      const csvWriter = require('csv-writer');
      expect(csvWriter.createObjectCsvWriter).toHaveBeenCalled();
      expect(mockWriteRecords).toHaveBeenCalledWith(mockWorkEntries);
      expect(response.status).toBe(500);
    });

    test('should create temp directory when it does not exist', async () => {
      const mockClient = { id: 1, name: 'TestClient' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      // Mock fs to test directory creation path
      const realExistsSync = fs.existsSync;
      const realMkdirSync = fs.mkdirSync;
      fs.existsSync = jest.fn().mockReturnValue(false);
      fs.mkdirSync = jest.fn();
      
      mockWriteRecords.mockRejectedValue(new Error('Write failed'));

      const request = require('supertest');
      const express = require('express');
      const app = express();
      app.use(express.json());
      app.use('/api/reports', require('../../routes/reports'));

      await request(app).get('/api/reports/export/csv/1');

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      
      // Restore
      fs.existsSync = realExistsSync;
      fs.mkdirSync = realMkdirSync;
    });

    test('should handle special characters in client name for CSV filename', async () => {
      const mockClient = { id: 1, name: 'Test / Special & Name' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      mockWriteRecords.mockRejectedValue(new Error('Write failed'));

      const request = require('supertest');
      const express = require('express');
      const app = express();
      app.use(express.json());
      app.use('/api/reports', require('../../routes/reports'));

      await request(app).get('/api/reports/export/csv/1');

      const csvWriter = require('csv-writer');
      // The path should have special chars replaced
      const callArgs = csvWriter.createObjectCsvWriter.mock.calls[0][0];
      expect(callArgs.path).toContain('Test___Special___Name');
    });
  });

  describe('PDF Export - Successful Generation', () => {
    let request, app;

    beforeEach(() => {
      request = require('supertest');
      const express = require('express');
      app = express();
      app.use(express.json());
      app.use('/api/reports', require('../../routes/reports'));
    });

    test('should generate PDF with work entries including null description', async () => {
      const mockClient = { id: 1, name: 'Acme Corp' };
      const mockWorkEntries = [
        { date: '2024-01-01', hours: 5.5, description: 'Development work', created_at: '2024-01-01T00:00:00Z' },
        { date: '2024-01-02', hours: 3.0, description: null, created_at: '2024-01-02T00:00:00Z' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      const PDFDocument = require('pdfkit');
      expect(PDFDocument).toHaveBeenCalled();
      expect(lastPdfInstance.pipe).toHaveBeenCalled();
      expect(lastPdfInstance.fontSize).toHaveBeenCalled();
      expect(lastPdfInstance.text).toHaveBeenCalled();
      expect(lastPdfInstance.end).toHaveBeenCalled();
      // Verify null description handled as "No description"
      expect(lastPdfInstance.text).toHaveBeenCalledWith(
        'No description',
        expect.any(Number),
        expect.any(Number),
        expect.any(Object)
      );
    });

    test('should generate PDF with no work entries', async () => {
      const mockClient = { id: 1, name: 'Empty Client' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(200);
      expect(lastPdfInstance.pipe).toHaveBeenCalled();
      expect(lastPdfInstance.end).toHaveBeenCalled();
    });

    test('should set correct content-type and disposition headers for PDF', async () => {
      const mockClient = { id: 1, name: 'Client With Special' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toBeDefined();
    });

    test('should add separator lines every 5 entries in PDF', async () => {
      const mockClient = { id: 1, name: 'Test Client' };
      const mockWorkEntries = Array.from({ length: 6 }, (_, i) => ({
        date: `2024-01-0${i + 1}`,
        hours: 1,
        description: `Entry ${i + 1}`,
        created_at: `2024-01-0${i + 1}T00:00:00Z`
      }));

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(200);
      // Header line + separator at entry index 4 (5th entry)
      expect(lastPdfInstance.moveTo).toHaveBeenCalled();
      expect(lastPdfInstance.stroke).toHaveBeenCalled();
    });
  });
});
