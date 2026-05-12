const request = require('supertest');
const { getDatabase } = require('../../database/init');
const { createTestApp, setupMockDb } = require('../helpers/testSetup');
const fs = require('fs');

jest.mock('../../database/init');
jest.mock('fs');

const mockWriteRecords = jest.fn();
jest.mock('csv-writer', () => ({
  createObjectCsvWriter: jest.fn(() => ({ writeRecords: mockWriteRecords }))
}));

let mockPdfRes = null;
const mockPdfInstance = {
  fontSize: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  moveDown: jest.fn().mockReturnThis(),
  moveTo: jest.fn().mockReturnThis(),
  lineTo: jest.fn().mockReturnThis(),
  stroke: jest.fn().mockReturnThis(),
  addPage: jest.fn().mockReturnThis(),
  pipe: jest.fn((res) => { mockPdfRes = res; }),
  end: jest.fn(() => { if (mockPdfRes) mockPdfRes.end(); }),
  y: 100
};
jest.mock('pdfkit', () => jest.fn().mockImplementation(() => mockPdfInstance));

jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const reportRoutes = require('../../routes/reports');
const app = createTestApp('/api/reports', reportRoutes, { wrapDownload: true });

describe('Report Routes - Coverage Gaps', () => {
  let mockDb;

  function resetPdfMocks() {
    mockPdfRes = null;
    mockPdfInstance.y = 100;
    for (const [key, val] of Object.entries(mockPdfInstance)) {
      if (typeof val === 'function' && val.mockClear) val.mockClear();
    }
    mockPdfInstance.pipe.mockImplementation((res) => { mockPdfRes = res; });
    mockPdfInstance.end.mockImplementation(() => { if (mockPdfRes) mockPdfRes.end(); });
    for (const m of ['fontSize', 'text', 'moveDown', 'moveTo', 'lineTo', 'stroke', 'addPage']) {
      mockPdfInstance[m].mockReturnThis();
    }
  }

  function stubReportData(client, entries) {
    mockDb.get.mockImplementation((q, p, cb) => cb(null, client));
    mockDb.all.mockImplementation((q, p, cb) => cb(null, entries));
  }

  beforeEach(() => {
    mockDb = setupMockDb(getDatabase);
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();
    fs.unlink = jest.fn((path, cb) => cb(null));
    mockWriteRecords.mockReset();
    resetPdfMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    getDatabase.mockReturnValue(mockDb);
  });

  describe('CSV Export - Success Path', () => {
    const sampleEntries = [
      { date: '2024-01-01', hours: 5, description: 'Dev work', created_at: '2024-01-01T00:00:00Z' },
      { date: '2024-01-02', hours: 3.5, description: 'Testing', created_at: '2024-01-02T00:00:00Z' }
    ];

    test('should generate and download CSV file with correct headers', async () => {
      stubReportData({ id: 1, name: 'Test Client' }, sampleEntries);
      mockWriteRecords.mockResolvedValue(undefined);

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      expect(require('csv-writer').createObjectCsvWriter).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.arrayContaining([
            expect.objectContaining({ id: 'date', title: 'Date' }),
            expect.objectContaining({ id: 'hours', title: 'Hours' })
          ])
        })
      );
      expect(mockWriteRecords).toHaveBeenCalledWith(sampleEntries);
      expect(fs.unlink).toHaveBeenCalled();
    });

    test('should sanitize special characters in CSV filename', async () => {
      stubReportData({ id: 1, name: 'Client @#$% Special!' }, []);
      mockWriteRecords.mockResolvedValue(undefined);

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      expect(require('csv-writer').createObjectCsvWriter).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringMatching(/Client_+Special_/) })
      );
    });

    test('should handle empty work entries', async () => {
      stubReportData({ id: 1, name: 'Empty Client' }, []);
      mockWriteRecords.mockResolvedValue(undefined);

      const response = await request(app).get('/api/reports/export/csv/1');
      expect(response.status).toBe(200);
      expect(mockWriteRecords).toHaveBeenCalledWith([]);
    });

    test('should handle fs.unlink error during cleanup', async () => {
      stubReportData({ id: 1, name: 'Test Client' }, sampleEntries.slice(0, 1));
      mockWriteRecords.mockResolvedValue(undefined);
      fs.unlink = jest.fn((p, cb) => cb(new Error('Permission denied')));

      const spy = jest.spyOn(console, 'error').mockImplementation();
      const response = await request(app).get('/api/reports/export/csv/1');
      expect(response.status).toBe(200);
      spy.mockRestore();
    });

    test('should handle download error and still cleanup', async () => {
      const errApp = createTestApp('/api/reports', reportRoutes, {
        wrapDownload: false, errorHandler: false
      });
      // Override download to simulate error
      const express = require('express');
      const errApp2 = express();
      errApp2.use(express.json());
      errApp2.use((req, res, next) => {
        res.download = function(fp, fn, cb) {
          res.status(200).send('');
          if (typeof cb === 'function') cb(new Error('Send failed'));
        };
        next();
      });
      errApp2.use('/api/reports', reportRoutes);

      stubReportData({ id: 1, name: 'Test Client' }, sampleEntries.slice(0, 1));
      mockWriteRecords.mockResolvedValue(undefined);

      const spy = jest.spyOn(console, 'error').mockImplementation();
      await request(errApp2).get('/api/reports/export/csv/1');
      expect(spy).toHaveBeenCalledWith('Error sending file:', expect.any(Error));
      expect(fs.unlink).toHaveBeenCalled();
      spy.mockRestore();
    });

    test('should create temp directory if it does not exist', async () => {
      stubReportData({ id: 1, name: 'Test Client' }, []);
      mockWriteRecords.mockResolvedValue(undefined);
      fs.existsSync.mockReturnValue(false);

      await request(app).get('/api/reports/export/csv/1');
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('PDF Export - Success Path', () => {
    test('should generate PDF with title and pipe to response', async () => {
      stubReportData({ id: 1, name: 'Test Client' }, [
        { date: '2024-01-01', hours: 5.5, description: 'Development', created_at: '2024-01-01' }
      ]);

      await request(app).get('/api/reports/export/pdf/1');

      expect(mockPdfInstance.pipe).toHaveBeenCalled();
      expect(mockPdfInstance.fontSize).toHaveBeenCalledWith(20);
      expect(mockPdfInstance.text).toHaveBeenCalledWith(
        'Time Report for Test Client', expect.objectContaining({ align: 'center' })
      );
      expect(mockPdfInstance.end).toHaveBeenCalled();
    });

    test('should calculate correct total hours', async () => {
      stubReportData({ id: 1, name: 'Test Client' }, [
        { date: '2024-01-01', hours: 2.5, description: 'W1', created_at: '2024-01-01' },
        { date: '2024-01-02', hours: 3.75, description: 'W2', created_at: '2024-01-02' },
        { date: '2024-01-03', hours: 1.25, description: 'W3', created_at: '2024-01-03' }
      ]);

      await request(app).get('/api/reports/export/pdf/1');
      expect(mockPdfInstance.text).toHaveBeenCalledWith('Total Hours: 7.50');
      expect(mockPdfInstance.text).toHaveBeenCalledWith('Total Entries: 3');
    });

    test('should handle empty entries with zero totals', async () => {
      stubReportData({ id: 1, name: 'Empty' }, []);

      await request(app).get('/api/reports/export/pdf/1');
      expect(mockPdfInstance.text).toHaveBeenCalledWith('Total Hours: 0.00');
      expect(mockPdfInstance.text).toHaveBeenCalledWith('Total Entries: 0');
    });

    test('should show "No description" for null descriptions', async () => {
      stubReportData({ id: 1, name: 'Client' }, [
        { date: '2024-01-01', hours: 4, description: null, created_at: '2024-01-01' }
      ]);

      await request(app).get('/api/reports/export/pdf/1');
      expect(mockPdfInstance.text).toHaveBeenCalledWith(
        'No description', 230, expect.any(Number), { width: 300 }
      );
    });

    test('should add page break when y exceeds 700', async () => {
      stubReportData({ id: 1, name: 'Client' }, [
        { date: '2024-01-01', hours: 2, description: 'E1', created_at: '2024-01-01' }
      ]);
      mockPdfInstance.y = 750;

      await request(app).get('/api/reports/export/pdf/1');
      expect(mockPdfInstance.addPage).toHaveBeenCalled();
    });

    test('should add separator line every 5 entries', async () => {
      const entries = Array.from({ length: 6 }, (_, i) => ({
        date: `2024-01-0${i + 1}`, hours: 2, description: `E${i + 1}`, created_at: `2024-01-0${i + 1}`
      }));
      stubReportData({ id: 1, name: 'Client' }, entries);

      await request(app).get('/api/reports/export/pdf/1');
      expect(mockPdfInstance.moveTo.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    test('should set correct content-type and sanitize filename', async () => {
      stubReportData({ id: 1, name: 'PDF @Client!' }, []);

      const response = await request(app).get('/api/reports/export/pdf/1');
      expect(response.headers['content-type']).toMatch(/application\/pdf/);
      expect(response.headers['content-disposition']).toMatch(/PDF__Client_/);
    });

    test('should handle many entries with correct totals', async () => {
      const entries = Array.from({ length: 10 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`, hours: 1.5,
        description: `Task ${i + 1}`, created_at: `2024-01-${String(i + 1).padStart(2, '0')}`
      }));
      stubReportData({ id: 1, name: 'Busy Client' }, entries);

      await request(app).get('/api/reports/export/pdf/1');
      expect(mockPdfInstance.text).toHaveBeenCalledWith('Total Hours: 15.00');
      expect(mockPdfInstance.text).toHaveBeenCalledWith('Total Entries: 10');
    });
  });

  describe('Edge Cases', () => {
    test('should handle CSV entries with special characters', async () => {
      const entries = [{ date: '2024-01-01', hours: 5, description: '"quotes", commas', created_at: '2024-01-01' }];
      stubReportData({ id: 1, name: 'Test Client' }, entries);
      mockWriteRecords.mockResolvedValue(undefined);

      await request(app).get('/api/reports/export/csv/1');
      expect(mockWriteRecords).toHaveBeenCalledWith(entries);
    });

    test('should handle database error for PDF work entries', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, { id: 1, name: 'Client' }));
      mockDb.all.mockImplementation((q, p, cb) => cb(new Error('DB error'), null));

      const response = await request(app).get('/api/reports/export/pdf/1');
      expect(response.status).toBe(500);
    });
  });
});
