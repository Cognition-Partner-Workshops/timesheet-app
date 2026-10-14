// Integration tests for report routes using a real in-memory SQLite database.
jest.unmock('sqlite3');

const request = require('supertest');
const express = require('express');

const { initializeDatabase, closeDatabase, getDatabase } = require('../../database/init');
const reportRoutes = require('../../routes/reports');

const USER_EMAIL = 'reports-integration@example.com';
const OTHER_USER_EMAIL = 'other-user@example.com';

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

async function insertClient(name, userEmail = USER_EMAIL) {
  const result = await run(
    'INSERT INTO clients (name, user_email) VALUES (?, ?)',
    [name, userEmail]
  );
  return result.lastID;
}

async function insertWorkEntry(clientId, { hours, description, date, userEmail = USER_EMAIL }) {
  await run(
    'INSERT INTO work_entries (client_id, user_email, hours, description, date) VALUES (?, ?, ?, ?, ?)',
    [clientId, userEmail, hours, description, date]
  );
}

function authedGet(app, url, email = USER_EMAIL) {
  return request(app).get(url).set('x-user-email', email);
}

describe('Report Routes (integration)', () => {
  let app;
  let clientId;
  let otherUsersClientId;

  beforeAll(async () => {
    await initializeDatabase();

    app = express();
    app.use(express.json());
    app.use('/api/reports', reportRoutes);

    await run('INSERT INTO users (email) VALUES (?)', [USER_EMAIL]);
    await run('INSERT INTO users (email) VALUES (?)', [OTHER_USER_EMAIL]);

    clientId = await insertClient('Acme Corp');
    otherUsersClientId = await insertClient('Rival Inc', OTHER_USER_EMAIL);

    await insertWorkEntry(clientId, { hours: 2.5, description: 'January work', date: '2024-01-15' });
    await insertWorkEntry(clientId, { hours: 4, description: 'February work', date: '2024-02-10' });
    await insertWorkEntry(clientId, { hours: 1.25, description: 'March work', date: '2024-03-05' });
    await insertWorkEntry(otherUsersClientId, {
      hours: 8,
      description: 'Other user work',
      date: '2024-02-10',
      userEmail: OTHER_USER_EMAIL
    });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /api/reports/client/:clientId', () => {
    test('returns all entries when no date range is given', async () => {
      const response = await authedGet(app, `/api/reports/client/${clientId}`);

      expect(response.status).toBe(200);
      expect(response.body.client).toEqual({ id: clientId, name: 'Acme Corp' });
      expect(response.body.entryCount).toBe(3);
      expect(response.body.totalHours).toBeCloseTo(7.75);
      expect(response.body.workEntries.map((e) => e.date)).toEqual([
        '2024-03-05',
        '2024-02-10',
        '2024-01-15'
      ]);
    });

    test('filters entries by startDate and endDate', async () => {
      const response = await authedGet(
        app,
        `/api/reports/client/${clientId}?startDate=2024-02-01&endDate=2024-02-28`
      );

      expect(response.status).toBe(200);
      expect(response.body.entryCount).toBe(1);
      expect(response.body.totalHours).toBe(4);
      expect(response.body.workEntries[0].description).toBe('February work');
    });

    test('filters entries by startDate only', async () => {
      const response = await authedGet(
        app,
        `/api/reports/client/${clientId}?startDate=2024-02-10`
      );

      expect(response.status).toBe(200);
      expect(response.body.entryCount).toBe(2);
      expect(response.body.workEntries.map((e) => e.date)).toEqual(['2024-03-05', '2024-02-10']);
    });

    test('filters entries by endDate only', async () => {
      const response = await authedGet(
        app,
        `/api/reports/client/${clientId}?endDate=2024-01-31`
      );

      expect(response.status).toBe(200);
      expect(response.body.entryCount).toBe(1);
      expect(response.body.workEntries[0].date).toBe('2024-01-15');
    });

    test('date range boundaries are inclusive', async () => {
      const response = await authedGet(
        app,
        `/api/reports/client/${clientId}?startDate=2024-01-15&endDate=2024-03-05`
      );

      expect(response.status).toBe(200);
      expect(response.body.entryCount).toBe(3);
    });

    test('returns empty report for a range with no entries', async () => {
      const response = await authedGet(
        app,
        `/api/reports/client/${clientId}?startDate=2025-01-01&endDate=2025-12-31`
      );

      expect(response.status).toBe(200);
      expect(response.body.entryCount).toBe(0);
      expect(response.body.totalHours).toBe(0);
      expect(response.body.workEntries).toEqual([]);
    });

    test('returns 400 for malformed startDate', async () => {
      const response = await authedGet(
        app,
        `/api/reports/client/${clientId}?startDate=01-15-2024`
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid startDate format. Expected YYYY-MM-DD' });
    });

    test('returns 400 for malformed endDate', async () => {
      const response = await authedGet(
        app,
        `/api/reports/client/${clientId}?endDate=not-a-date`
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid endDate format. Expected YYYY-MM-DD' });
    });

    test('returns 400 when startDate is after endDate', async () => {
      const response = await authedGet(
        app,
        `/api/reports/client/${clientId}?startDate=2024-03-01&endDate=2024-01-01`
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'startDate must not be after endDate' });
    });

    test('returns 404 for another user\'s client', async () => {
      const response = await authedGet(app, `/api/reports/client/${otherUsersClientId}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
    });

    test('returns 401 without authentication header', async () => {
      const response = await request(app).get(`/api/reports/client/${clientId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/reports/export/csv/:clientId', () => {
    test('exports all entries as a CSV download', async () => {
      const response = await authedGet(app, `/api/reports/export/csv/${clientId}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toMatch(
        /attachment; filename="Acme_Corp_report_.*\.csv"/
      );

      const csv = response.text;
      expect(csv).toContain('Date,Hours,Description,Created At');
      expect(csv).toContain('January work');
      expect(csv).toContain('February work');
      expect(csv).toContain('March work');
    });

    test('exports only entries within the date range', async () => {
      const response = await authedGet(
        app,
        `/api/reports/export/csv/${clientId}?startDate=2024-02-01&endDate=2024-02-28`
      );

      expect(response.status).toBe(200);

      const csv = response.text;
      expect(csv).toContain('February work');
      expect(csv).not.toContain('January work');
      expect(csv).not.toContain('March work');
    });

    test('exports header-only CSV when no entries match', async () => {
      const response = await authedGet(
        app,
        `/api/reports/export/csv/${clientId}?startDate=2025-01-01`
      );

      expect(response.status).toBe(200);
      expect(response.text.trim()).toBe('Date,Hours,Description,Created At');
    });

    test('returns 400 when startDate is after endDate', async () => {
      const response = await authedGet(
        app,
        `/api/reports/export/csv/${clientId}?startDate=2024-06-01&endDate=2024-01-01`
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'startDate must not be after endDate' });
    });

    test('returns 404 for nonexistent client', async () => {
      const response = await authedGet(app, '/api/reports/export/csv/999999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
    });

    test('returns 400 for invalid client ID', async () => {
      const response = await authedGet(app, '/api/reports/export/csv/abc');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });
  });

  describe('GET /api/reports/export/pdf/:clientId', () => {
    test('exports a PDF document', async () => {
      const response = await authedGet(app, `/api/reports/export/pdf/${clientId}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toMatch(
        /attachment; filename="Acme_Corp_report_.*\.pdf"/
      );
      expect(response.body.slice(0, 5).toString()).toBe('%PDF-');
    });

    test('exports a PDF when filtered by date range', async () => {
      const response = await authedGet(
        app,
        `/api/reports/export/pdf/${clientId}?startDate=2024-02-01&endDate=2024-02-28`
      )
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.body.slice(0, 5).toString()).toBe('%PDF-');
    });

    test('returns 400 for malformed endDate', async () => {
      const response = await authedGet(
        app,
        `/api/reports/export/pdf/${clientId}?endDate=2024/01/01`
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid endDate format. Expected YYYY-MM-DD' });
    });

    test('returns 404 for nonexistent client', async () => {
      const response = await authedGet(app, '/api/reports/export/pdf/999999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Client not found' });
    });

    test('returns 400 for invalid client ID', async () => {
      const response = await authedGet(app, '/api/reports/export/pdf/xyz');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid client ID' });
    });
  });
});
