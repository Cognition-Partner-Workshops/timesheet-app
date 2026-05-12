const { request, setupMockDb, mockDbRow, mockDbRows } = require('../helpers/testSetup');
const express = require('express');
const { getDatabase } = require('../../database/init');
const fs = require('fs');

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

  /** Sets up client + work entries mocks for report endpoints */
  function setupReportMocks(client, entries) {
    mockDb.get.mockImplementation(mockDbRow(client));
    mockDb.all.mockImplementation(mockDbRows(entries));
  }

  /** Helper to generate N work entries */
  function generateEntries(n, overrides = {}) {
    return Array.from({ length: n }, (_, i) => ({
      hours: 1, description: `Entry ${i}`, date: '2024-01-01', ...overrides
    }));
  }

  beforeEach(() => {
    mockDb = setupMockDb();
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();
    fs.unlink = jest.fn((p, callback) => callback(null));
    mockWriteRecords = jest.fn().mockResolvedValue(undefined);
    mockPipeTarget = null;
    mockYValueFn = () => 100;
  });

  afterEach(() => { jest.clearAllMocks(); });

  describe('PDF Export - Full Success Path', () => {
    test('should generate PDF with work entries', async () => {
      setupReportMocks({ id: 1, name: 'PDF Client' }, [
        { hours: 5, description: 'Dev work', date: '2024-01-01' },
        { hours: 3.5, description: 'Testing', date: '2024-01-02' }
      ]);
      await request(app).get('/api/reports/export/pdf/1');
      expect(mockPdfDoc.pipe).toHaveBeenCalled();
      expect(mockPdfDoc.fontSize).toHaveBeenCalled();
      expect(mockPdfDoc.text).toHaveBeenCalled();
      expect(mockPdfDoc.end).toHaveBeenCalled();
    });

    test('should generate PDF with empty work entries', async () => {
      setupReportMocks({ id: 1, name: 'Empty PDF Client' }, []);
      await request(app).get('/api/reports/export/pdf/1');
      expect(mockPdfDoc.pipe).toHaveBeenCalled();
      expect(mockPdfDoc.end).toHaveBeenCalled();
    });

    test('should calculate correct total hours in PDF header', async () => {
      setupReportMocks({ id: 1, name: 'Hours Client' }, [
        { hours: 2.5, description: 'A', date: '2024-01-01' },
        { hours: 3.75, description: 'B', date: '2024-01-02' },
        { hours: 1.25, description: 'C', date: '2024-01-03' }
      ]);
      await request(app).get('/api/reports/export/pdf/1');
      const textCalls = mockPdfDoc.text.mock.calls.map(c => c[0]);
      expect(textCalls.some(t => t && t.includes && t.includes('7.50'))).toBe(true);
    });

    test('should add page break when y exceeds 700', async () => {
      setupReportMocks({ id: 1, name: 'Long Report' }, generateEntries(30));
      let mockYCallCount = 0;
      mockYValueFn = () => (++mockYCallCount > 15 ? 750 : 100);
      await request(app).get('/api/reports/export/pdf/1');
      expect(mockPdfDoc.addPage).toHaveBeenCalled();
      expect(mockPdfDoc.end).toHaveBeenCalled();
    });

    test('should add separator line every 5 entries', async () => {
      setupReportMocks({ id: 1, name: 'Separator Client' }, generateEntries(10));
      await request(app).get('/api/reports/export/pdf/1');
      expect(mockPdfDoc.moveTo.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    test('should handle work entries without description in PDF', async () => {
      setupReportMocks({ id: 1, name: 'No Desc Client' }, [
        { hours: 4, description: null, date: '2024-01-01' },
        { hours: 2, description: '', date: '2024-01-02' }
      ]);
      await request(app).get('/api/reports/export/pdf/1');
      const textCalls = mockPdfDoc.text.mock.calls.map(c => c[0]);
      expect(textCalls.some(t => t === 'No description')).toBe(true);
    });

    test('should set correct content-type and disposition headers', async () => {
      setupReportMocks({ id: 1, name: 'Header Client' }, []);
      const response = await request(app).get('/api/reports/export/pdf/1');
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('Header_Client');
    });

    test('should sanitize special characters in PDF filename', async () => {
      setupReportMocks({ id: 1, name: 'Test / Client & Co.' }, [
        { hours: 1, description: 'Test', date: '2024-01-01' }
      ]);
      const response = await request(app).get('/api/reports/export/pdf/1');
      expect(response.headers['content-disposition']).toContain('Test___Client___Co_');
    });

    test('should handle maximum hours entries in PDF total', async () => {
      setupReportMocks({ id: 1, name: 'Max Hours' }, [
        { hours: 24, description: 'Full day', date: '2024-01-01' },
        { hours: 24, description: 'Full day', date: '2024-01-02' }
      ]);
      await request(app).get('/api/reports/export/pdf/1');
      const textCalls = mockPdfDoc.text.mock.calls.map(c => c[0]);
      expect(textCalls.some(t => t && t.includes && t.includes('48.00'))).toBe(true);
    });
  });

  describe('CSV Export - Error Handling', () => {
    test('should handle CSV writeRecords rejection', async () => {
      setupReportMocks({ id: 1, name: 'CSV Error' }, [
        { date: '2024-01-01', hours: 5, description: 'Test', created_at: '2024-01-01' }
      ]);
      mockWriteRecords = jest.fn().mockRejectedValue(new Error('Write failed'));
      const response = await request(app).get('/api/reports/export/csv/1');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to generate CSV report' });
    });

    test('should create temp directory if it does not exist', async () => {
      setupReportMocks({ id: 1, name: 'DirTest' }, []);
      fs.existsSync.mockReturnValue(false);
      mockWriteRecords = jest.fn().mockRejectedValue(new Error('Write failed'));
      await request(app).get('/api/reports/export/csv/1');
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('Client Report - Additional Edge Cases', () => {
    test('should handle single work entry with fractional hours', async () => {
      setupReportMocks({ id: 1, name: 'Single' }, [{ id: 1, hours: 0.25, description: 'Quick', date: '2024-01-01' }]);
      const response = await request(app).get('/api/reports/client/1');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ totalHours: 0.25, entryCount: 1 });
    });

    test('should handle many entries with correct aggregation', async () => {
      setupReportMocks({ id: 1, name: 'Large' },
        Array.from({ length: 100 }, (_, i) => ({ id: i + 1, hours: 1.5, description: `E${i}`, date: '2024-01-01' }))
      );
      const response = await request(app).get('/api/reports/client/1');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ totalHours: 150, entryCount: 100 });
    });

    test.each([
      ['negative ID', '/api/reports/client/-1'],
      ['floating point ID', '/api/reports/client/1.5']
    ])('should handle %s', async (_, url) => {
      mockDb.get.mockImplementation(mockDbRow(null));
      await request(app).get(url);
      expect(mockDb.get).toHaveBeenCalled();
    });
  });

  describe('CSV Export - Boundary Conditions', () => {
    test('should pass correct CSV header configuration', async () => {
      setupReportMocks({ id: 1, name: 'CSV Headers' }, []);
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
      setupReportMocks({ id: 1, name: 'Test / Client & Co.' }, []);
      mockWriteRecords = jest.fn().mockRejectedValue(new Error('Write failed'));
      await request(app).get('/api/reports/export/csv/1');
      const csvWriter = require('csv-writer');
      const csvPath = csvWriter.createObjectCsvWriter.mock.calls[0][0].path;
      expect(csvPath).toContain('Test___Client___Co_');
    });
  });
});
