const request = require('supertest');
const { getDatabase } = require('../../database/init');
const fs = require('fs');
const { setupMockDb, createTestApp, mockDbGet, mockDbAll } = require('../helpers/testSetup');

jest.mock('../../database/init');
jest.mock('fs');
jest.mock('csv-writer', () => ({
  createObjectCsvWriter: jest.fn(() => ({
    writeRecords: jest.fn().mockResolvedValue(undefined)
  }))
}));
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
      pipe: jest.fn(function (dest) { piped = dest; }),
      end: jest.fn(function () { if (piped && piped.end) piped.end(); }),
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

const pdfApp = createTestApp('/api/reports', reportRoutes);

function csvApp(downloadBehavior) {
  return createTestApp('/api/reports', reportRoutes, {
    downloadOverride: (filePath, filename, callback) => {
      callback(downloadBehavior instanceof Error ? downloadBehavior : null);
    }
  });
}

function setupCsvMocks(mockDb, clientName, workEntries) {
  mockDbGet(mockDb, { id: 1, name: clientName });
  mockDbAll(mockDb, workEntries);
  const csvWriter = require('csv-writer');
  csvWriter.createObjectCsvWriter.mockReturnValue({
    writeRecords: jest.fn().mockResolvedValue(undefined)
  });
  return csvWriter;
}

describe('Report Routes - Coverage Gaps', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = setupMockDb();
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();
    fs.unlink = jest.fn((path, callback) => callback(null));
  });
  afterEach(() => { jest.clearAllMocks(); });

  describe('CSV Export - Success Path', () => {
    const entries = [
      { date: '2024-01-01', hours: 5, description: 'Work 1', created_at: '2024-01-01T00:00:00Z' },
      { date: '2024-01-02', hours: 3, description: 'Work 2', created_at: '2024-01-02T00:00:00Z' }
    ];

    test('should generate and download CSV file', async () => {
      const writer = setupCsvMocks(mockDb, 'Test Client', entries);
      await request(csvApp(null)).get('/api/reports/export/csv/1');
      expect(writer.createObjectCsvWriter).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalled();
    });

    test('should handle download error and still clean up', async () => {
      setupCsvMocks(mockDb, 'Test Client', entries.slice(0, 1));
      await request(csvApp(new Error('Download failed'))).get('/api/reports/export/csv/1');
      expect(fs.unlink).toHaveBeenCalled();
    });

    test('should handle unlink error gracefully', async () => {
      setupCsvMocks(mockDb, 'Special-Client!', entries.slice(0, 1));
      fs.unlink = jest.fn((p, cb) => cb(new Error('Unlink failed')));
      await request(csvApp(null)).get('/api/reports/export/csv/1');
      expect(fs.unlink).toHaveBeenCalled();
    });

    test('should handle empty work entries', async () => {
      const writer = setupCsvMocks(mockDb, 'Empty Client', []);
      await request(csvApp(null)).get('/api/reports/export/csv/1');
      expect(writer.createObjectCsvWriter).toHaveBeenCalled();
    });
  });

  describe('PDF Export - Success Path', () => {
    function setupPdfMocks(mockDb, clientName, workEntries) {
      mockDbGet(mockDb, { id: 1, name: clientName });
      mockDbAll(mockDb, workEntries);
    }

    test('should generate PDF with work entries', async () => {
      setupPdfMocks(mockDb, 'PDF Client', [
        { hours: 8, description: 'Full day', date: '2024-01-15' },
        { hours: 4, description: 'Half day', date: '2024-01-16' },
        { hours: 2, description: null, date: '2024-01-17' }
      ]);
      const PDFDocument = require('pdfkit');
      await request(pdfApp).get('/api/reports/export/pdf/1');
      const doc = PDFDocument.mock.results[PDFDocument.mock.results.length - 1].value;
      expect(doc.pipe).toHaveBeenCalled();
      expect(doc.end).toHaveBeenCalled();
    });

    test('should generate PDF with empty work entries', async () => {
      setupPdfMocks(mockDb, 'Empty Client', []);
      const PDFDocument = require('pdfkit');
      await request(pdfApp).get('/api/reports/export/pdf/1');
      const doc = PDFDocument.mock.results[PDFDocument.mock.results.length - 1].value;
      expect(doc.pipe).toHaveBeenCalled();
      expect(doc.end).toHaveBeenCalled();
    });

    test('should add page break when y exceeds 700', async () => {
      const entries = Array.from({ length: 10 }, (_, i) => ({
        hours: 2, description: `Item ${i}`, date: `2024-01-${String(i + 1).padStart(2, '0')}`
      }));
      setupPdfMocks(mockDb, 'Long Report', entries);

      const PDFDocument = require('pdfkit');
      PDFDocument.mockImplementation(() => {
        let piped = null;
        return {
          fontSize: jest.fn().mockReturnThis(), text: jest.fn().mockReturnThis(),
          moveDown: jest.fn().mockReturnThis(), moveTo: jest.fn().mockReturnThis(),
          lineTo: jest.fn().mockReturnThis(), stroke: jest.fn().mockReturnThis(),
          addPage: jest.fn().mockReturnThis(),
          pipe: jest.fn(function (d) { piped = d; }),
          end: jest.fn(function () { if (piped && piped.end) piped.end(); }),
          y: 750
        };
      });
      await request(pdfApp).get('/api/reports/export/pdf/1');
      const doc = PDFDocument.mock.results[PDFDocument.mock.results.length - 1].value;
      expect(doc.addPage).toHaveBeenCalled();
    });

    test('should add separator lines every 5 entries', async () => {
      const entries = Array.from({ length: 6 }, (_, i) => ({
        hours: 1, description: `Entry ${i}`, date: `2024-01-${String(i + 1).padStart(2, '0')}`
      }));
      setupPdfMocks(mockDb, 'Separator Client', entries);
      const PDFDocument = require('pdfkit');
      await request(pdfApp).get('/api/reports/export/pdf/1');
      const doc = PDFDocument.mock.results[PDFDocument.mock.results.length - 1].value;
      expect(doc.moveTo).toHaveBeenCalled();
      expect(doc.stroke).toHaveBeenCalled();
    });

    test('should handle null description with fallback text', async () => {
      setupPdfMocks(mockDb, 'Null Desc', [{ hours: 3, description: null, date: '2024-01-01' }]);
      const PDFDocument = require('pdfkit');
      await request(pdfApp).get('/api/reports/export/pdf/1');
      const doc = PDFDocument.mock.results[PDFDocument.mock.results.length - 1].value;
      expect(doc.text).toHaveBeenCalledWith('No description', expect.any(Number), expect.any(Number), expect.any(Object));
    });
  });
});
