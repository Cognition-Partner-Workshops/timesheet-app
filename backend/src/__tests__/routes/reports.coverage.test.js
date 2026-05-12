const request = require('supertest');
const express = require('express');
const { getDatabase } = require('../../database/init');
const fs = require('fs');
const path = require('path');

jest.mock('../../database/init');
jest.mock('fs');

let mockWriteRecords;
jest.mock('csv-writer', () => ({
  createObjectCsvWriter: jest.fn(() => ({
    writeRecords: (...args) => mockWriteRecords(...args)
  }))
}));

let mockPdfDoc;
let mockPipeTarget;
let mockYValueFn = () => 100;
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => {
    mockPdfDoc = {
      fontSize: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      moveDown: jest.fn().mockReturnThis(),
      moveTo: jest.fn().mockReturnThis(),
      lineTo: jest.fn().mockReturnThis(),
      stroke: jest.fn().mockReturnThis(),
      addPage: jest.fn().mockReturnThis(),
      pipe: jest.fn((target) => { mockPipeTarget = target; }),
      end: jest.fn(() => {
        if (mockPipeTarget && typeof mockPipeTarget.end === 'function') {
          mockPipeTarget.end();
        }
      })
    };
    Object.defineProperty(mockPdfDoc, 'y', {
      get: () => mockYValueFn(),
      configurable: true
    });
    return mockPdfDoc;
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

describe('Reports Routes - Coverage Improvement', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      all: jest.fn(),
      get: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);

    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();
    fs.unlink = jest.fn((p, callback) => callback(null));

    mockWriteRecords = jest.fn().mockResolvedValue(undefined);
    mockPipeTarget = null;
    mockYValueFn = () => 100;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PDF Export - Full Success Path', () => {
    test('should successfully generate PDF with work entries', async () => {
      const mockClient = { id: 1, name: 'PDF Client' };
      const mockWorkEntries = [
        { hours: 5, description: 'Dev work', date: '2024-01-01' },
        { hours: 3.5, description: 'Testing', date: '2024-01-02' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(mockPdfDoc.pipe).toHaveBeenCalled();
      expect(mockPdfDoc.fontSize).toHaveBeenCalled();
      expect(mockPdfDoc.text).toHaveBeenCalled();
      expect(mockPdfDoc.end).toHaveBeenCalled();
    });

    test('should generate PDF with empty work entries', async () => {
      const mockClient = { id: 1, name: 'Empty PDF Client' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(mockPdfDoc.pipe).toHaveBeenCalled();
      expect(mockPdfDoc.end).toHaveBeenCalled();
    });

    test('should calculate correct total hours in PDF header', async () => {
      const mockClient = { id: 1, name: 'Hours Client' };
      const mockWorkEntries = [
        { hours: 2.5, description: 'Work A', date: '2024-01-01' },
        { hours: 3.75, description: 'Work B', date: '2024-01-02' },
        { hours: 1.25, description: 'Work C', date: '2024-01-03' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      // Total should be 7.50
      const textCalls = mockPdfDoc.text.mock.calls.map(c => c[0]);
      expect(textCalls.some(t => t && t.includes && t.includes('7.50'))).toBe(true);
    });

    test('should add page break when y exceeds 700', async () => {
      const mockClient = { id: 1, name: 'Long Report Client' };
      const mockWorkEntries = [];
      for (let i = 0; i < 30; i++) {
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

      // Override y getter to simulate page overflow
      let mockYCallCount = 0;
      mockYValueFn = () => {
        mockYCallCount++;
        return mockYCallCount > 15 ? 750 : 100;
      };

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(mockPdfDoc.addPage).toHaveBeenCalled();
      expect(mockPdfDoc.end).toHaveBeenCalled();
    });

    test('should add separator line every 5 entries', async () => {
      const mockClient = { id: 1, name: 'Separator Client' };
      const mockWorkEntries = [];
      for (let i = 0; i < 10; i++) {
        mockWorkEntries.push({
          hours: 1,
          description: `Entry ${i}`,
          date: '2024-01-01'
        });
      }

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      // moveTo is called for header separator + every 5th entry (2 separators for 10 entries)
      const moveToCallCount = mockPdfDoc.moveTo.mock.calls.length;
      expect(moveToCallCount).toBeGreaterThanOrEqual(3); // 1 header + 2 separators
    });

    test('should handle work entries without description in PDF', async () => {
      const mockClient = { id: 1, name: 'No Desc Client' };
      const mockWorkEntries = [
        { hours: 4, description: null, date: '2024-01-01' },
        { hours: 2, description: '', date: '2024-01-02' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      // Should use 'No description' fallback for null description
      const textCalls = mockPdfDoc.text.mock.calls.map(c => c[0]);
      expect(textCalls.some(t => t === 'No description')).toBe(true);
      expect(mockPdfDoc.end).toHaveBeenCalled();
    });

    test('should set correct content-type and disposition headers for PDF', async () => {
      const mockClient = { id: 1, name: 'Header Client' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('Header_Client');
    });

    test('should handle PDF export for client with special characters in name', async () => {
      const mockClient = { id: 1, name: 'Test / Client & Co.' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ hours: 1, description: 'Test', date: '2024-01-01' }]);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.headers['content-disposition']).toContain('Test___Client___Co_');
    });

    test('should handle PDF export with maximum hours entries', async () => {
      const mockClient = { id: 1, name: 'Max Hours Client' };
      const mockWorkEntries = [
        { hours: 24, description: 'Full day', date: '2024-01-01' },
        { hours: 24, description: 'Full day', date: '2024-01-02' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      const textCalls = mockPdfDoc.text.mock.calls.map(c => c[0]);
      expect(textCalls.some(t => t && t.includes && t.includes('48.00'))).toBe(true);
    });
  });

  describe('CSV Export - Error Handling', () => {
    test('should handle CSV writeRecords rejection', async () => {
      const mockClient = { id: 1, name: 'CSV Error Client' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ date: '2024-01-01', hours: 5, description: 'Test', created_at: '2024-01-01' }]);
      });

      mockWriteRecords = jest.fn().mockRejectedValue(new Error('Write failed'));

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to generate CSV report' });
    });

    test('should create temp directory if it does not exist', async () => {
      const mockClient = { id: 1, name: 'DirTest Client' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      fs.existsSync.mockReturnValue(false);
      mockWriteRecords = jest.fn().mockRejectedValue(new Error('Write failed'));

      await request(app).get('/api/reports/export/csv/1');

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('Client Report - Additional Edge Cases', () => {
    test('should handle single work entry with fractional hours', async () => {
      const mockClient = { id: 1, name: 'Single Entry Client' };
      const mockWorkEntries = [
        { id: 1, hours: 0.25, description: 'Quick task', date: '2024-01-01' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(200);
      expect(response.body.totalHours).toBe(0.25);
      expect(response.body.entryCount).toBe(1);
    });

    test('should handle many entries with correct aggregation', async () => {
      const mockClient = { id: 1, name: 'Large Client' };
      const mockWorkEntries = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        hours: 1.5,
        description: `Entry ${i}`,
        date: '2024-01-01'
      }));

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(200);
      expect(response.body.totalHours).toBe(150);
      expect(response.body.entryCount).toBe(100);
    });

    test('should handle negative client ID (parsed as integer)', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).get('/api/reports/client/-1');

      // parseInt('-1') = -1, so it goes to DB
      expect(mockDb.get).toHaveBeenCalled();
    });

    test('should handle floating point client ID', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).get('/api/reports/client/1.5');

      // parseInt('1.5') = 1
      expect(mockDb.get).toHaveBeenCalled();
    });
  });

  describe('CSV Export - Boundary Conditions', () => {
    test('should pass correct CSV header configuration', async () => {
      const mockClient = { id: 1, name: 'CSV Headers Client' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      mockWriteRecords = jest.fn().mockRejectedValue(new Error('Write failed'));

      await request(app).get('/api/reports/export/csv/1');

      const csvWriter = require('csv-writer');
      expect(csvWriter.createObjectCsvWriter).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.arrayContaining([
            expect.objectContaining({ id: 'date', title: 'Date' }),
            expect.objectContaining({ id: 'hours', title: 'Hours' }),
            expect.objectContaining({ id: 'description', title: 'Description' }),
            expect.objectContaining({ id: 'created_at', title: 'Created At' })
          ])
        })
      );
    });

    test('should use sanitized client name in CSV filename', async () => {
      const mockClient = { id: 1, name: 'Test / Client & Co.' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      mockWriteRecords = jest.fn().mockRejectedValue(new Error('Write failed'));

      await request(app).get('/api/reports/export/csv/1');

      const csvWriter = require('csv-writer');
      const csvPath = csvWriter.createObjectCsvWriter.mock.calls[0][0].path;
      expect(csvPath).toContain('Test___Client___Co_');
    });
  });
});
