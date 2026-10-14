const request = require('supertest');
const express = require('express');
const { getDatabase } = require('../../database/init');

jest.mock('../../database/init');
jest.mock('../../middleware/auth', () => ({
  authenticateUser: (req, res, next) => {
    req.userEmail = 'test@example.com';
    next();
  }
}));

const workEntryRoutes = require('../../routes/workEntries');

const app = express();
app.use(express.json());
app.use('/api/work-entries', workEntryRoutes);
app.use((err, req, res, next) => {
  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

describe('Work Entry Routes - unexpected failures', () => {
  beforeEach(() => {
    getDatabase.mockImplementation(() => {
      throw new Error('Connection pool exhausted');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('POST should forward a synchronous failure to the error handler', async () => {
    const response = await request(app)
      .post('/api/work-entries')
      .send({ clientId: 1, hours: 8, date: '2024-01-01' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
  });

  test('PUT should forward a synchronous failure to the error handler', async () => {
    const response = await request(app)
      .put('/api/work-entries/1')
      .send({ hours: 8 });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
  });
});
