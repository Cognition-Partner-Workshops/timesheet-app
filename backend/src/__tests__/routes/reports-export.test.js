const request = require('supertest');
const express = require('express');
const { getDatabase } = require('../../database/init');
const fs = require('fs');
const { createMockDb } = require('../helpers/testUtils');

jest.mock('../../database/init');
jest.mock('fs');

const mockWriteRecords = jest.fn();
jest.mock('csv-writer', () => ({
  createObjectCsvWriter: jest.fn(() => ({ writeRecords: mockWriteRecords }))
}));

jest.mock('pdfkit', () => {
  const chainable = () => jest.fn().mockReturnThis();
  return jest.fn().mockImplementation(() => {
    let output = null;
    return {
      fontSize: chainable(), text: chainable(), moveDown: chainable(),
      moveTo: chainable(), lineTo: chainable(), stroke: chainable(),
      addPage: chainable(),
      pipe: jest.fn(function(dest) { output = dest; }),
      end: jest.fn(function() { if (output) output.end(); }),
      y: 100
    };
  });
});

jest.mock('../../middleware/auth', () => ({ authenticateUser: (req, res, next) => { req.userEmail = 'test@example.com'; next(); } }));

const reportRoutes = require('../../routes/reports');
const app = express();
app.use(express.json());
app.use('/api/reports', reportRoutes);

describe('Report Routes - Export Success Paths', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    getDatabase.mockReturnValue(mockDb);
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();
    fs.unlink = jest.fn((path, cb) => cb(null));
    mockWriteRecords.mockReset();
  });

  afterEach(() => { jest.clearAllMocks(); });

  function setupClientAndEntries(client, entries) {
    mockDb.get.mockImplementation((q, p, cb) => cb(null, client));
    mockDb.all.mockImplementation((q, p, cb) => cb(null, entries));
  }

  describe('PDF Export', () => {
    test('should generate PDF with work entries and correct headers', async () => {
      setupClientAndEntries(
        { id: 1, name: 'Test Client' },
        [
          { date: '2024-01-01', hours: 5, description: 'Development' },
          { date: '2024-01-02', hours: 3.5, description: null }
        ]
      );
      const response = await request(app).get('/api/reports/export/pdf/1');
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    test('should handle empty work entries', async () => {
      setupClientAndEntries({ id: 1, name: 'Empty Client' }, []);
      const response = await request(app).get('/api/reports/export/pdf/1');
      expect(response.status).toBe(200);
    });

    test('should sanitize client name in filename', async () => {
      setupClientAndEntries({ id: 1, name: 'Client/Special@Name' }, []);
      const response = await request(app).get('/api/reports/export/pdf/1');
      expect(response.headers['content-disposition']).toContain('Client_Special_Name');
    });

    test('should handle many entries with separator lines', async () => {
      const entries = Array.from({ length: 6 }, (_, i) => ({
        date: `2024-01-0${i + 1}`, hours: 2, description: `Task ${i + 1}`
      }));
      setupClientAndEntries({ id: 1, name: 'Client' }, entries);
      const response = await request(app).get('/api/reports/export/pdf/1');
      expect(response.status).toBe(200);
    });

    test('should return 500 on database error fetching entries', async () => {
      mockDb.get.mockImplementation((q, p, cb) => cb(null, { id: 1, name: 'Client' }));
      mockDb.all.mockImplementation((q, p, cb) => cb(new Error('DB error'), null));
      const response = await request(app).get('/api/reports/export/pdf/1');
      expect(response.status).toBe(500);
    });
  });

  describe('CSV Export', () => {
    test('should return 500 on CSV write failure', async () => {
      setupClientAndEntries(
        { id: 1, name: 'Test Client' },
        [{ date: '2024-01-01', hours: 5, description: 'Work', created_at: '2024-01-01T10:00:00' }]
      );
      mockWriteRecords.mockRejectedValue(new Error('Write failed'));
      const response = await request(app).get('/api/reports/export/csv/1');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to generate CSV report' });
    });

    test('should create temp directory if not exists', async () => {
      setupClientAndEntries({ id: 1, name: 'Client' }, []);
      fs.existsSync.mockReturnValue(false);
      mockWriteRecords.mockRejectedValue(new Error('Write failed'));
      await request(app).get('/api/reports/export/csv/1');
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    test('should skip directory creation if temp exists', async () => {
      setupClientAndEntries({ id: 1, name: 'Client' }, []);
      fs.existsSync.mockReturnValue(true);
      mockWriteRecords.mockRejectedValue(new Error('Write failed'));
      await request(app).get('/api/reports/export/csv/1');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    test('should configure CSV writer with correct headers', async () => {
      setupClientAndEntries({ id: 1, name: 'Client' }, []);
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

    test('should sanitize client name in CSV path', async () => {
      setupClientAndEntries({ id: 1, name: 'Test/Client@Special' }, []);
      mockWriteRecords.mockRejectedValue(new Error('Write failed'));
      await request(app).get('/api/reports/export/csv/1');
      const csvWriter = require('csv-writer');
      expect(csvWriter.createObjectCsvWriter).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringContaining('Test_Client_Special') })
      );
    });
  });
});
