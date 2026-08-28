const request = require('supertest');
const express = require('express');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');
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
      pipe: jest.fn((stream) => { pipedStream = stream; }),
      end: jest.fn(function() { if (pipedStream) pipedStream.end(); }),
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

const app = express();
app.use(express.json());
app.use('/api/reports', reportRoutes);

describe('Report Routes', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = { all: jest.fn(), get: jest.fn() };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function setupMocks(client, entries) {
    mockDb.get.mockImplementation((q, p, cb) => cb(null, client));
    if (entries !== undefined) {
      mockDb.all.mockImplementation((q, p, cb) => cb(null, entries));
    }
  }

  function setupDbError(method) {
    mockDb[method].mockImplementation((q, p, cb) => cb(new Error('Database error'), null));
  }

  const endpoints = [
    { path: '/api/reports/client', name: 'client report' },
    { path: '/api/reports/export/csv', name: 'CSV export' },
    { path: '/api/reports/export/pdf', name: 'PDF export' }
  ];

  describe.each(endpoints)('$name common behavior', ({ path }) => {
    test('should return 404 for non-existent client', async () => {
      setupMocks(null);
      const response = await request(app).get(`${path}/999`);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
    });

    test('should return 400 for invalid client ID', async () => {
      const response = await request(app).get(`${path}/invalid`);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });

    test('should handle database error when fetching client', async () => {
      setupDbError('get');
      const response = await request(app).get(`${path}/1`);
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/reports/client/:clientId', () => {
    test('should return client report with work entries', async () => {
      const mockWorkEntries = [
        { id: 1, hours: 5.5, description: 'Work 1', date: '2024-01-01' },
        { id: 2, hours: 3.0, description: 'Work 2', date: '2024-01-02' }
      ];
      setupMocks({ id: 1, name: 'Test Client' }, mockWorkEntries);

      const response = await request(app).get('/api/reports/client/1');

      expect(response.status).toBe(200);
      expect(response.body.client).toEqual({ id: 1, name: 'Test Client' });
      expect(response.body.workEntries).toEqual(mockWorkEntries);
      expect(response.body.totalHours).toBe(8.5);
      expect(response.body.entryCount).toBe(2);
    });

    test('should return report with zero hours for client with no entries', async () => {
      setupMocks({ id: 1, name: 'Empty Client' }, []);
      const response = await request(app).get('/api/reports/client/1');
      expect(response.status).toBe(200);
      expect(response.body.totalHours).toBe(0);
      expect(response.body.entryCount).toBe(0);
    });

    test('should handle database error when fetching work entries', async () => {
      setupMocks({ id: 1, name: 'Test Client' });
      setupDbError('all');
      const response = await request(app).get('/api/reports/client/1');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should filter work entries by user email', async () => {
      setupMocks({ id: 1, name: 'Test Client' });
      mockDb.all.mockImplementation((query, params, callback) => {
        expect(params).toEqual([1, 'test@example.com']);
        callback(null, []);
      });
      const response = await request(app).get('/api/reports/client/1');
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/reports/export/csv/:clientId', () => {
    test('should export CSV with correct content type and content', async () => {
      setupMocks({ id: 1, name: 'Test Client' }, [
        { date: '2024-01-01', hours: 5.5, description: 'Work 1', created_at: '2024-01-01T10:00:00' },
        { date: '2024-01-02', hours: 3.0, description: 'Work 2', created_at: '2024-01-02T10:00:00' }
      ]);

      const response = await request(app).get('/api/reports/export/csv/1');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');
      expect(response.text).toContain('Date,Hours,Description,Created At');
      expect(response.text).toContain('2024-01-01');
      expect(response.text).toContain('5.5');
    });

    test('should handle CSV export with no entries (header only)', async () => {
      setupMocks({ id: 1, name: 'Test Client' }, []);
      const response = await request(app).get('/api/reports/export/csv/1');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toContain('Date,Hours,Description,Created At');
    });

    test('should handle database error when fetching entries', async () => {
      setupMocks({ id: 1, name: 'Test Client' });
      setupDbError('all');
      const response = await request(app).get('/api/reports/export/csv/1');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    test('should not create temp files during CSV export', async () => {
      const fs = require('fs');
      const spies = ['existsSync', 'mkdirSync', 'writeFileSync'].map(m => jest.spyOn(fs, m));
      setupMocks(
        { id: 1, name: 'Test Client' },
        [{ date: '2024-01-01', hours: 5.5, description: 'Work 1', created_at: '2024-01-01T10:00:00' }]
      );

      await request(app).get('/api/reports/export/csv/1');

      spies.forEach(spy => { expect(spy).not.toHaveBeenCalled(); spy.mockRestore(); });
    });

    test('should properly escape descriptions with commas and quotes in CSV', async () => {
      setupMocks(
        { id: 1, name: 'Test Client' },
        [{ date: '2024-01-01', hours: 2.0, description: 'Work with "quotes" and, commas', created_at: '2024-01-01T10:00:00' }]
      );
      const response = await request(app).get('/api/reports/export/csv/1');
      expect(response.status).toBe(200);
      expect(response.text).toContain('""quotes""');
    });
  });

  describe('GET /api/reports/export/pdf/:clientId', () => {
    test('should export PDF with correct content type', async () => {
      setupMocks(
        { id: 1, name: 'Test Client' },
        [{ hours: 5.5, description: 'Work 1', date: '2024-01-01', created_at: '2024-01-01T10:00:00' }]
      );
      const response = await request(app).get('/api/reports/export/pdf/1');
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.pdf');
    });

    test('should handle database error when fetching entries', async () => {
      setupMocks({ id: 1, name: 'Test Client' });
      setupDbError('all');
      const response = await request(app).get('/api/reports/export/pdf/1');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });
});
