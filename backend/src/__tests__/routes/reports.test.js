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


  describe('CSV Export Download Path (handler-level)', () => {
    function getRouteHandler(routePath) {
      const router = require('../../routes/reports');
      const layer = router.stack.find(l => l.route && l.route.path === routePath);
      return layer.route.stack[layer.route.stack.length - 1].handle;
    }

    test('should call res.download after successful CSV write and clean up file', (done) => {
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
        writeRecords: jest.fn().mockResolvedValue(undefined)
      });

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        download: jest.fn((filePath, fileName, callback) => {
          callback(null);
        }),
        setHeader: jest.fn()
      };

      const handler = getRouteHandler('/export/csv/:clientId');
      handler({ params: { clientId: '1' }, userEmail: 'test@example.com' }, mockRes, jest.fn());

      setTimeout(() => {
        expect(mockRes.download).toHaveBeenCalledWith(
          expect.stringContaining('.csv'),
          expect.stringContaining('Test_Client'),
          expect.any(Function)
        );
        expect(fs.unlink).toHaveBeenCalled();
        done();
      }, 100);
    });

    test('should handle download error and still clean up temp file', (done) => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
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
        writeRecords: jest.fn().mockResolvedValue(undefined)
      });

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        download: jest.fn((filePath, fileName, callback) => {
          callback(new Error('Download failed'));
        }),
        setHeader: jest.fn()
      };

      const handler = getRouteHandler('/export/csv/:clientId');
      handler({ params: { clientId: '1' }, userEmail: 'test@example.com' }, mockRes, jest.fn());

      setTimeout(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending file:', expect.any(Error));
        expect(fs.unlink).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
        done();
      }, 100);
    });

    test('should handle unlink error during cleanup', (done) => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ date: '2024-01-01', hours: 5, description: 'Work', created_at: '2024-01-01' }]);
      });

      fs.unlink = jest.fn((unlinkPath, callback) => callback(new Error('Unlink error')));

      const csvWriter = require('csv-writer');
      csvWriter.createObjectCsvWriter.mockReturnValue({
        writeRecords: jest.fn().mockResolvedValue(undefined)
      });

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        download: jest.fn((filePath, fileName, callback) => {
          callback(null);
        }),
        setHeader: jest.fn()
      };

      const handler = getRouteHandler('/export/csv/:clientId');
      handler({ params: { clientId: '1' }, userEmail: 'test@example.com' }, mockRes, jest.fn());

      setTimeout(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting temp file:', expect.any(Error));
        consoleErrorSpy.mockRestore();
        done();
      }, 100);
    });
  });

  describe('PDF Export Success Path (handler-level)', () => {
    function getRouteHandler(routePath) {
      const router = require('../../routes/reports');
      const layer = router.stack.find(l => l.route && l.route.path === routePath);
      return layer.route.stack[layer.route.stack.length - 1].handle;
    }

    test('should generate PDF with work entries and set correct headers', () => {
      const PDFDocument = require('pdfkit');
      let pdfMock;
      PDFDocument.mockImplementation(() => {
        pdfMock = {
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
        };
        return pdfMock;
      });

      const mockClient = { id: 1, name: 'Test Client' };
      const mockWorkEntries = [
        { date: '2024-01-01', hours: 5, description: 'Work 1', created_at: '2024-01-01' },
        { date: '2024-01-02', hours: 3, description: 'Work 2', created_at: '2024-01-02' },
        { date: '2024-01-03', hours: 2, description: null, created_at: '2024-01-03' }
      ];

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockClient);
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn()
      };

      const handler = getRouteHandler('/export/pdf/:clientId');
      handler({ params: { clientId: '1' }, userEmail: 'test@example.com' }, mockRes, jest.fn());

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('Test_Client')
      );
      expect(pdfMock.pipe).toHaveBeenCalledWith(mockRes);
      expect(pdfMock.text).toHaveBeenCalledWith(
        expect.stringContaining('Time Report for Test Client'),
        expect.any(Object)
      );
      expect(pdfMock.text).toHaveBeenCalledWith('No description', 230, expect.any(Number), { width: 300 });
      expect(pdfMock.end).toHaveBeenCalled();
    });

    test('should generate PDF with empty work entries', () => {
      const PDFDocument = require('pdfkit');
      let pdfMock;
      PDFDocument.mockImplementation(() => {
        pdfMock = {
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
        };
        return pdfMock;
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn()
      };

      const handler = getRouteHandler('/export/pdf/:clientId');
      handler({ params: { clientId: '1' }, userEmail: 'test@example.com' }, mockRes, jest.fn());

      expect(pdfMock.pipe).toHaveBeenCalledWith(mockRes);
      expect(pdfMock.text).toHaveBeenCalledWith('Total Entries: 0');
      expect(pdfMock.end).toHaveBeenCalled();
    });

    test('should trigger page break when y exceeds 700', () => {
      const PDFDocument = require('pdfkit');
      let pdfMock;
      PDFDocument.mockImplementation(() => {
        pdfMock = {
          fontSize: jest.fn().mockReturnThis(),
          text: jest.fn().mockReturnThis(),
          moveDown: jest.fn().mockReturnThis(),
          moveTo: jest.fn().mockReturnThis(),
          lineTo: jest.fn().mockReturnThis(),
          stroke: jest.fn().mockReturnThis(),
          addPage: jest.fn().mockReturnThis(),
          pipe: jest.fn(),
          end: jest.fn(),
          y: 750
        };
        return pdfMock;
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { date: '2024-01-01', hours: 2, description: 'Work 1', created_at: '2024-01-01' }
        ]);
      });

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn()
      };

      const handler = getRouteHandler('/export/pdf/:clientId');
      handler({ params: { clientId: '1' }, userEmail: 'test@example.com' }, mockRes, jest.fn());

      expect(pdfMock.addPage).toHaveBeenCalled();
      expect(pdfMock.end).toHaveBeenCalled();
    });

    test('should add separator lines every 5 entries in PDF', () => {
      const PDFDocument = require('pdfkit');
      let pdfMock;
      PDFDocument.mockImplementation(() => {
        pdfMock = {
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
        };
        return pdfMock;
      });

      const mockWorkEntries = [];
      for (let i = 0; i < 6; i++) {
        mockWorkEntries.push({
          date: `2024-01-${String(i + 1).padStart(2, '0')}`,
          hours: 2,
          description: `Work ${i + 1}`,
          created_at: '2024-01-01'
        });
      }

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, name: 'Test Client' });
      });
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockWorkEntries);
      });

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn()
      };

      const handler = getRouteHandler('/export/pdf/:clientId');
      handler({ params: { clientId: '1' }, userEmail: 'test@example.com' }, mockRes, jest.fn());

      expect(pdfMock.end).toHaveBeenCalled();
      // 1 for the header line + 1 for separator after 5th entry = at least 2
      const moveToCallCount = pdfMock.moveTo.mock.calls.length;
      expect(moveToCallCount).toBeGreaterThanOrEqual(2);
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
});
