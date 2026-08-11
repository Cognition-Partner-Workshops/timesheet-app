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
// Add error handler for Joi validation
app.use((err, req, res, next) => {
  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

describe('Work Entry Routes - Date Persistence', () => {
  let mockDb;
  let consoleErrorSpy;

  beforeEach(() => {
    mockDb = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn()
    };
    getDatabase.mockReturnValue(mockDb);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  const mockWriteSucceeds = () => {
    mockDb.get
      .mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }))
      .mockImplementationOnce((query, params, callback) => callback(null, { id: 10 }));
    mockDb.run.mockImplementation(function (query, params, callback) {
      callback.call({ lastID: 10, changes: 1 }, null);
    });
  };

  test('POST should store the date as a YYYY-MM-DD string, not epoch milliseconds', async () => {
    mockWriteSucceeds();

    const response = await request(app)
      .post('/api/work-entries')
      .send({ clientId: 1, hours: 7.5, date: '2024-03-09' });

    expect(response.status).toBe(201);
    const [, params] = mockDb.run.mock.calls[0];
    expect(params[4]).toBe('2024-03-09');
  });

  test('POST should truncate a full ISO timestamp to the calendar date', async () => {
    mockWriteSucceeds();

    await request(app)
      .post('/api/work-entries')
      .send({ clientId: 1, hours: 1, date: '2024-03-09T18:30:00.000Z' });

    const [, params] = mockDb.run.mock.calls[0];
    expect(params[4]).toBe('2024-03-09');
  });

  test('PUT should store an updated date as a YYYY-MM-DD string', async () => {
    mockDb.get
      .mockImplementationOnce((query, params, callback) => callback(null, { id: 5 }))
      .mockImplementationOnce((query, params, callback) => callback(null, { id: 5 }));
    mockDb.run.mockImplementation(function (query, params, callback) {
      callback.call({ changes: 1 }, null);
    });

    const response = await request(app)
      .put('/api/work-entries/5')
      .send({ date: '2024-03-09' });

    expect(response.status).toBe(200);
    const [, values] = mockDb.run.mock.calls[0];
    expect(values[0]).toBe('2024-03-09');
  });
});
