const request = require('supertest');
const express = require('express');
const { getDatabase } = require('../../database/init');
const fs = require('fs');

jest.mock('../../database/init');
jest.mock('fs');

const mockWriteRecords = jest.fn();
jest.mock('csv-writer', () => ({
  createObjectCsvWriter: jest.fn(() => ({
    writeRecords: mockWriteRecords
  }))
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

jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => mockPdfInstance);
});

jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const reportRoutes = require('../../routes/reports');

function createApp() {
  const app = express();
  app.use(express.json());
  // Wrap res.download so Express doesn't hit real filesystem
  app.use((req, res, next) => {
    const origDownload = res.download;
    res.download = function(filePath, filename, callback) {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send('file-content');
      if (typeof callback === 'function') callback(null);
    };
    next();
  });
  app.use('/api/reports', reportRoutes);
  return app;
}

const app = createApp();

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

    mockWriteRecords.mockReset();
    mockPdfRes = null;
    mockPdfInstance.y = 100;

    // Clear all mock call counts
    Object.values(mockPdfInstance).forEach(fn => {
      if (typeof fn === 'function' && fn.mockClear) fn.mockClear();
    });
    // Re-set the pipe/end behavior after clear
    mockPdfInstance.pipe.mockImplementation((res) => { mockPdfRes = res; });
    mockPdfInstance.end.mockImplementation(() => { if (mockPdfRes) mockPdfRes.end(); });
    // Re-set chaining returns
    mockPdfInstance.fontSize.mockReturnThis();
    mockPdfInstance.text.mockReturnThis();
    mockPdfInstance.moveDown.mockReturnThis();
    mockPdfInstance.moveTo.mockReturnThis();
    mockPdfInstance.lineTo.mockReturnThis();
    mockPdfInstance.stroke.mockReturnThis();
    mockPdfInstance.addPage.mockReturnThis();
  });

  afterEach(() => {
    jest.clearAllMocks();
    getDatabase.mockReturnValue(mockDb);
  });

  describe('GET /api/reports/export/csv/:clientId - Success Path', () => {
    test('should successfully generate and download CSV file', async () => {
      const mockClient = { id: 1, name: 'Test Client' };
      const mockWorkEntries = [
        { date: '2024-01-01', hours: 5, description: 'Dev work', created_at: '2024-01-01T00:00:00Z' },
        { date: '2024-01-02', hours: 3.5, description: 'Testing', created_at: '2024-01-02T00:00:00Z' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });
      mockWriteRecords.mockResolvedValue(undefined);

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      const csvWriter = require('csv-writer');
      expect(csvWriter.createObjectCsvWriter).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.arrayContaining([
            expect.objectContaining({ id: 'date', title: 'Date' }),
            expect.objectContaining({ id: 'hours', title: 'Hours' })
          ])
        })
      );
      expect(mockWriteRecords).toHaveBeenCalledWith(mockWorkEntries);
      expect(fs.unlink).toHaveBeenCalled();
    });

    test('should sanitize client name with special characters in CSV filename', async () => {
      const mockClient = { id: 1, name: 'Client @#$% Special!' };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });
      mockWriteRecords.mockResolvedValue(undefined);

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      const csvWriter = require('csv-writer');
      expect(csvWriter.createObjectCsvWriter).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringMatching(/Client_+Special_/)
        })
      );
    });

    test('should handle empty work entries for CSV export', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Empty Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });
      mockWriteRecords.mockResolvedValue(undefined);

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      expect(mockWriteRecords).toHaveBeenCalledWith([]);
    });

    test('should handle fs.unlink error during temp file cleanup', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ date: '2024-01-01', hours: 5, description: 'Work', created_at: '2024-01-01' }]);
      });
      mockWriteRecords.mockResolvedValue(undefined);
      fs.unlink = jest.fn((path, callback) => callback(new Error('Permission denied')));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      expect(fs.unlink).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should handle download error gracefully', async () => {
      // Use a separate app with download error simulation
      const errApp = express();
      errApp.use(express.json());
      errApp.use((req, res, next) => {
        const origDownload = res.download;
        res.download = function(filePath, filename, callback) {
          res.status(200).send('');
          if (typeof callback === 'function') callback(new Error('Send failed'));
        };
        next();
      });
      errApp.use('/api/reports', reportRoutes);

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ date: '2024-01-01', hours: 5, description: 'Work', created_at: '2024-01-01' }]);
      });
      mockWriteRecords.mockResolvedValue(undefined);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await request(errApp).get('/api/reports/export/csv/1');

      // The download error path logs the error
      expect(consoleSpy).toHaveBeenCalledWith('Error sending file:', expect.any(Error));
      // fs.unlink is still called even when download errors
      expect(fs.unlink).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should create temp directory if it does not exist', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });
      mockWriteRecords.mockResolvedValue(undefined);
      fs.existsSync.mockReturnValue(false);

      await request(app).get('/api/reports/export/csv/1');

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('GET /api/reports/export/pdf/:clientId - Success Path', () => {
    test('should successfully generate PDF with work entries', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { date: '2024-01-01', hours: 5.5, description: 'Development', created_at: '2024-01-01' },
          { date: '2024-01-02', hours: 3.0, description: 'Testing', created_at: '2024-01-02' }
        ]);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(mockPdfInstance.pipe).toHaveBeenCalled();
      expect(mockPdfInstance.fontSize).toHaveBeenCalledWith(20);
      expect(mockPdfInstance.text).toHaveBeenCalledWith(
        'Time Report for Test Client',
        expect.objectContaining({ align: 'center' })
      );
      expect(mockPdfInstance.end).toHaveBeenCalled();
    });

    test('should generate PDF with correct total hours calculation', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { date: '2024-01-01', hours: 2.5, description: 'Work 1', created_at: '2024-01-01' },
          { date: '2024-01-02', hours: 3.75, description: 'Work 2', created_at: '2024-01-02' },
          { date: '2024-01-03', hours: 1.25, description: 'Work 3', created_at: '2024-01-03' }
        ]);
      });

      await request(app).get('/api/reports/export/pdf/1');

      expect(mockPdfInstance.text).toHaveBeenCalledWith('Total Hours: 7.50');
      expect(mockPdfInstance.text).toHaveBeenCalledWith('Total Entries: 3');
    });

    test('should generate PDF with empty work entries', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Empty Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      await request(app).get('/api/reports/export/pdf/1');

      expect(mockPdfInstance.text).toHaveBeenCalledWith('Total Hours: 0.00');
      expect(mockPdfInstance.text).toHaveBeenCalledWith('Total Entries: 0');
      expect(mockPdfInstance.end).toHaveBeenCalled();
    });

    test('should handle entries with null description in PDF', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { date: '2024-01-01', hours: 4, description: null, created_at: '2024-01-01' }
        ]);
      });

      await request(app).get('/api/reports/export/pdf/1');

      expect(mockPdfInstance.text).toHaveBeenCalledWith(
        'No description', 230, expect.any(Number), { width: 300 }
      );
      expect(mockPdfInstance.end).toHaveBeenCalled();
    });

    test('should add page break when y exceeds 700', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { date: '2024-01-01', hours: 2, description: 'Entry 1', created_at: '2024-01-01' }
        ]);
      });
      mockPdfInstance.y = 750;

      await request(app).get('/api/reports/export/pdf/1');

      expect(mockPdfInstance.addPage).toHaveBeenCalled();
    });

    test('should add separator line every 5 entries', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      const entries = Array.from({ length: 6 }, (_, i) => ({
        date: `2024-01-0${i + 1}`,
        hours: 2,
        description: `Entry ${i + 1}`,
        created_at: `2024-01-0${i + 1}`
      }));
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, entries);
      });

      await request(app).get('/api/reports/export/pdf/1');

      // moveTo called for header line + separator at 5th entry = at least 2
      const moveToCount = mockPdfInstance.moveTo.mock.calls.length;
      expect(moveToCount).toBeGreaterThanOrEqual(2);
    });

    test('should set correct response headers for PDF', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'PDF Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.headers['content-type']).toMatch(/application\/pdf/);
    });

    test('should sanitize client name in PDF filename', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Client @Special!' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/reports/export/pdf/1');

      expect(response.headers['content-disposition']).toMatch(/Client__Special_/);
    });

    test('should handle many entries requiring multiple separators', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Busy Client' });
      });
      const entries = Array.from({ length: 10 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        hours: 1.5,
        description: `Task ${i + 1}`,
        created_at: `2024-01-${String(i + 1).padStart(2, '0')}`
      }));
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, entries);
      });

      await request(app).get('/api/reports/export/pdf/1');

      expect(mockPdfInstance.text).toHaveBeenCalledWith('Total Hours: 15.00');
      expect(mockPdfInstance.text).toHaveBeenCalledWith('Total Entries: 10');
      expect(mockPdfInstance.end).toHaveBeenCalled();
    });
  });

  describe('CSV Export - Edge Cases', () => {
    test('should handle work entries containing special characters', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      const entries = [
        { date: '2024-01-01', hours: 5, description: 'Work with "quotes" and, commas', created_at: '2024-01-01' }
      ];
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, entries);
      });
      mockWriteRecords.mockResolvedValue(undefined);

      await request(app).get('/api/reports/export/csv/1');

      expect(mockWriteRecords).toHaveBeenCalledWith(entries);
    });
  });

  describe('PDF Export - Edge Cases', () => {
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
});
