const request = require('supertest');
const express = require('express');
const { getDatabase } = require('../../database/init');
const fs = require('fs');
const path = require('path');

jest.mock('../../database/init');
jest.mock('fs');

// Mock csv-writer with controllable behavior
const mockWriteRecords = jest.fn();
jest.mock('csv-writer', () => ({
  createObjectCsvWriter: jest.fn(() => ({
    writeRecords: mockWriteRecords
  }))
}));

// Mock PDFKit with event-based piping that ends the response
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
      pipe: jest.fn(function(stream) { pipedStream = stream; }),
      end: jest.fn(function() {
        if (pipedStream) pipedStream.end();
      }),
      y: 100
    };
  });
});

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

describe('Report Routes - PDF Export Success Paths', () => {
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
    mockWriteRecords.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/reports/export/pdf/:clientId - Success Path', () => {
    test('should successfully generate PDF with work entries', async () => {
      const mockClient = { id: 1, name: 'Test Client' };
      const mockWorkEntries = [
        { date: '2024-01-01', hours: 5, description: 'Development work' },
        { date: '2024-01-02', hours: 3.5, description: 'Code review' },
        { date: '2024-01-03', hours: 4, description: null }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    test('should generate PDF with empty work entries', async () => {
      const mockClient = { id: 1, name: 'Empty Client' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(200);
    });

    test('should set correct PDF response headers with sanitized filename', async () => {
      const mockClient = { id: 1, name: 'Client/With@Special#Chars' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.headers['content-disposition']).toContain('Client_With_Special_Chars');
    });

    test('should handle entries that trigger page break (y > 700)', async () => {
      const PDFDocument = require('pdfkit');
      // Configure mock to have high y value
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
          pipe: jest.fn(function(stream) { pipedStream = stream; }),
          end: jest.fn(function() {
            if (pipedStream) pipedStream.end();
          }),
          y: 750  // > 700, triggers addPage
        };
      });

      const mockClient = { id: 1, name: 'Test Client' };
      const mockWorkEntries = [
        { date: '2024-01-01', hours: 2, description: 'Work' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(200);
    });

    test('should handle many entries (separator lines every 5)', async () => {
      const mockClient = { id: 1, name: 'Test Client' };
      const mockWorkEntries = Array.from({ length: 6 }, (_, i) => ({
        date: `2024-01-0${i + 1}`,
        hours: 2,
        description: `Work ${i + 1}`
      }));

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.status).toBe(200);
    });

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
  });

  describe('GET /api/reports/export/csv/:clientId - Success Path', () => {
    test('should handle CSV write error', async () => {
      const mockClient = { id: 1, name: 'Test Client' };
      const mockWorkEntries = [
        { date: '2024-01-01', hours: 5, description: 'Work', created_at: '2024-01-01T10:00:00' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      mockWriteRecords.mockRejectedValue(new Error('Write failed'));

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to generate CSV report' });
    });

    test('should create temp directory if it does not exist', async () => {
      const mockClient = { id: 1, name: 'Test Client' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      fs.existsSync.mockReturnValue(false);
      mockWriteRecords.mockRejectedValue(new Error('Write failed'));

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    test('should not create temp directory if it already exists', async () => {
      const mockClient = { id: 1, name: 'Test Client' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      fs.existsSync.mockReturnValue(true);
      mockWriteRecords.mockRejectedValue(new Error('Write failed'));

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    test('should sanitize client name in CSV filename', async () => {
      const mockClient = { id: 1, name: 'Test/Client@Special' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      mockWriteRecords.mockRejectedValue(new Error('Write failed'));

      await request(app).get('/api/reports/export/csv/1');

      const csvWriter = require('csv-writer');
      expect(csvWriter.createObjectCsvWriter).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringContaining('Test_Client_Special')
        })
      );
    });

    test('should configure CSV writer with correct headers', async () => {
      const mockClient = { id: 1, name: 'Test Client' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      mockWriteRecords.mockRejectedValue(new Error('Write failed'));

      await request(app).get('/api/reports/export/csv/1');

      const csvWriter = require('csv-writer');
      expect(csvWriter.createObjectCsvWriter).toHaveBeenCalledWith(
        expect.objectContaining({
          header: [
            { id: 'date', title: 'Date' },
            { id: 'hours', title: 'Hours' },
            { id: 'description', title: 'Description' },
            { id: 'created_at', title: 'Created At' }
          ]
        })
      );
    });

    test('should call writeRecords with work entries', async () => {
      const mockClient = { id: 1, name: 'Test Client' };
      const mockWorkEntries = [
        { date: '2024-01-01', hours: 5, description: 'Work', created_at: '2024-01-01T10:00:00' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      mockWriteRecords.mockRejectedValue(new Error('Write failed'));

      await request(app).get('/api/reports/export/csv/1');

      expect(mockWriteRecords).toHaveBeenCalledWith(mockWorkEntries);
    });
  });
});
