const request = require('supertest');
const express = require('express');

// Validation is normally synchronous and safe; forcing it to throw exercises the
// try/catch fallbacks that hand unexpected errors to the Express error handler.
const shouldThrow = { client: false, updateClient: false, workEntry: false, updateWorkEntry: false };

jest.mock('../../validation/schemas', () => {
  const actual = jest.requireActual('../../validation/schemas');
  const guard = (key, schema) => ({
    validate: (body) => {
      if (shouldThrow[key]) {
        throw new Error('Unexpected validation failure');
      }
      return schema.validate(body);
    }
  });

  return {
    ...actual,
    clientSchema: guard('client', actual.clientSchema),
    updateClientSchema: guard('updateClient', actual.updateClientSchema),
    workEntrySchema: guard('workEntry', actual.workEntrySchema),
    updateWorkEntrySchema: guard('updateWorkEntry', actual.updateWorkEntrySchema)
  };
});

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const clientRoutes = require('../../routes/clients');
const workEntryRoutes = require('../../routes/workEntries');
const { getDatabase } = require('../../database/init');
const { errorHandler } = require('../../middleware/errorHandler');

const app = express();
app.use(express.json());
app.use('/api/clients', clientRoutes);
app.use('/api/work-entries', workEntryRoutes);
app.use(errorHandler);

describe('Route Error Propagation', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    getDatabase.mockReturnValue({ all: jest.fn(), get: jest.fn(), run: jest.fn() });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    Object.keys(shouldThrow).forEach((key) => {
      shouldThrow[key] = false;
    });
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  test('POST /api/clients should forward unexpected errors to the error handler', async () => {
    shouldThrow.client = true;

    const response = await request(app).post('/api/clients').send({ name: 'Acme' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Unexpected validation failure' });
  });

  test('PUT /api/clients/:id should forward unexpected errors to the error handler', async () => {
    shouldThrow.updateClient = true;

    const response = await request(app).put('/api/clients/1').send({ name: 'Acme' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Unexpected validation failure' });
  });

  test('POST /api/work-entries should forward unexpected errors to the error handler', async () => {
    shouldThrow.workEntry = true;

    const response = await request(app)
      .post('/api/work-entries')
      .send({ clientId: 1, hours: 2, date: '2024-01-01' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Unexpected validation failure' });
  });

  test('PUT /api/work-entries/:id should forward unexpected errors to the error handler', async () => {
    shouldThrow.updateWorkEntry = true;

    const response = await request(app).put('/api/work-entries/1').send({ hours: 2 });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Unexpected validation failure' });
  });

  test('should surface SQLite errors as a database error response', async () => {
    const sqliteError = new Error('constraint failed');
    sqliteError.code = 'SQLITE_CONSTRAINT';

    getDatabase.mockReturnValue({
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn((query, params, callback) => {
        throw sqliteError;
      })
    });

    const response = await request(app).post('/api/clients').send({ name: 'Acme' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Database error',
      message: 'An error occurred while processing your request'
    });
  });
});
