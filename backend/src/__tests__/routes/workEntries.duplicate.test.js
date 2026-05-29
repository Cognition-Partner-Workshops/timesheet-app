const request = require('supertest');
const express = require('express');
const workEntryRoutes = require('../../routes/workEntries');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/api/work-entries', workEntryRoutes);
app.use((err, req, res, next) => {
  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

describe('POST /api/work-entries/:id/duplicate', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should duplicate an existing work entry with today\'s date', async () => {
    const originalEntry = {
      id: 1,
      client_id: 10,
      hours: 4.5,
      description: 'Frontend development',
      date: '2024-06-01',
      user_email: 'test@example.com',
      client_name: 'Acme Corp'
    };

    const today = new Date().toISOString().split('T')[0];

    const duplicatedEntry = {
      id: 2,
      client_id: originalEntry.client_id,
      hours: originalEntry.hours,
      description: originalEntry.description,
      date: today,
      client_name: originalEntry.client_name
    };

    mockDb.get.mockImplementation((query, params, callback) => {
      if (query.includes('work_entries') && !query.includes('we.id = ?')) {
        // Lookup by ID without user filter (for 403 vs 404 distinction)
        callback(null, originalEntry);
      } else if (query.includes('we.id = ?') || query.includes('WHERE we.id')) {
        // Return the newly created duplicate
        callback(null, duplicatedEntry);
      } else {
        callback(null, originalEntry);
      }
    });

    mockDb.run.mockImplementation(function (query, params, callback) {
      this.lastID = 2;
      callback.call(this, null);
    });

    const response = await request(app)
      .post('/api/work-entries/1/duplicate');

    expect(response.status).toBe(201);
    expect(response.body.workEntry).toBeDefined();
    expect(response.body.workEntry.client_id).toBe(originalEntry.client_id);
    expect(response.body.workEntry.hours).toBe(originalEntry.hours);
    expect(response.body.workEntry.description).toBe(originalEntry.description);
    expect(response.body.workEntry.date).toBe(today);
    expect(response.body.workEntry.id).not.toBe(originalEntry.id);
  });

  test('should return 404 when work entry does not exist', async () => {
    mockDb.get.mockImplementation((query, params, callback) => {
      callback(null, null);
    });

    const response = await request(app)
      .post('/api/work-entries/9999/duplicate');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Work entry not found' });
  });

  test('should return 403 when work entry belongs to another user', async () => {
    const otherUsersEntry = {
      id: 5,
      client_id: 10,
      hours: 3,
      description: 'Design review',
      date: '2024-06-01',
      user_email: 'other@example.com',
      client_name: 'Acme Corp'
    };

    mockDb.get.mockImplementation((query, params, callback) => {
      if (query.includes('user_email') && params.includes('test@example.com')) {
        // Query filtered by current user — entry not found for this user
        callback(null, null);
      } else {
        // Query without user filter — entry exists but belongs to someone else
        callback(null, otherUsersEntry);
      }
    });

    const response = await request(app)
      .post('/api/work-entries/5/duplicate');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Not authorized to duplicate this work entry' });
  });
});
