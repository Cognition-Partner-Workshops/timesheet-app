jest.unmock('sqlite3');
// This file uses the real in-memory SQLite database.

const express = require('express');
const request = require('supertest');
const clientRoutes = require('../../routes/clients');
const workEntryRoutes = require('../../routes/workEntries');
const reportRoutes = require('../../routes/reports');
const { initializeDatabase, closeDatabase } = require('../../database/init');

const app = express();
app.use(express.json());
app.use('/api/clients', clientRoutes);
app.use('/api/work-entries', workEntryRoutes);
app.use('/api/reports', reportRoutes);

const weekStart = '2026-10-26';

async function createClient(userEmail, name) {
  const response = await request(app)
    .post('/api/clients')
    .set('x-user-email', userEmail)
    .send({ name });

  expect(response.status).toBe(201);
  return response.body.client.id;
}

async function createWorkEntry(userEmail, clientId, date, hours) {
  const response = await request(app)
    .post('/api/work-entries')
    .set('x-user-email', userEmail)
    .send({ clientId, date, hours });

  expect(response.status).toBe(201);
}

async function getWeeklyReport(userEmail, start = weekStart) {
  return request(app)
    .get('/api/reports/weekly')
    .set('x-user-email', userEmail)
    .query({ weekStart: start });
}

beforeAll(async () => {
  await initializeDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('GET /api/reports/weekly', () => {
  test('returns weekly totals, days, and a sorted client breakdown', async () => {
    const userEmail = 'weekly-total@example.com';
    const clientA = await createClient(userEmail, 'Client A');
    const clientB = await createClient(userEmail, 'Client B');

    await createWorkEntry(userEmail, clientA, '2026-10-26', 4);
    await createWorkEntry(userEmail, clientA, '2026-10-27', 3);
    await createWorkEntry(userEmail, clientA, '2026-10-30', 2);
    await createWorkEntry(userEmail, clientB, '2026-10-28', 5);
    await createWorkEntry(userEmail, clientB, '2026-10-29', 1);

    const response = await getWeeklyReport(userEmail);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      weekStart: '2026-10-26',
      weekEnd: '2026-11-01',
      totalHours: 15,
      overLimit: false,
      limit: 40,
      days: [
        { date: '2026-10-26', hours: 4 },
        { date: '2026-10-27', hours: 3 },
        { date: '2026-10-28', hours: 5 },
        { date: '2026-10-29', hours: 1 },
        { date: '2026-10-30', hours: 2 },
        { date: '2026-10-31', hours: 0 },
        { date: '2026-11-01', hours: 0 }
      ],
      clients: [
        { clientId: clientA, clientName: 'Client A', hours: 9 },
        { clientId: clientB, clientName: 'Client B', hours: 6 }
      ]
    });
  });

  test('includes Monday and Sunday while excluding the previous Sunday and next Monday', async () => {
    const userEmail = 'weekly-boundaries@example.com';
    const clientId = await createClient(userEmail, 'Boundary Client');

    await createWorkEntry(userEmail, clientId, '2026-10-25', 2);
    await createWorkEntry(userEmail, clientId, '2026-10-26', 3);
    await createWorkEntry(userEmail, clientId, '2026-11-01', 4);
    await createWorkEntry(userEmail, clientId, '2026-11-02', 5);

    const response = await getWeeklyReport(userEmail);

    expect(response.status).toBe(200);
    expect(response.body.totalHours).toBe(7);
    expect(response.body.days[0]).toEqual({ date: '2026-10-26', hours: 3 });
    expect(response.body.days[6]).toEqual({ date: '2026-11-01', hours: 4 });
  });

  test('returns seven zero-filled days and no clients for an empty week', async () => {
    const response = await getWeeklyReport('weekly-empty@example.com', '2026-11-02');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      weekStart: '2026-11-02',
      weekEnd: '2026-11-08',
      totalHours: 0,
      overLimit: false,
      limit: 40,
      days: [
        { date: '2026-11-02', hours: 0 },
        { date: '2026-11-03', hours: 0 },
        { date: '2026-11-04', hours: 0 },
        { date: '2026-11-05', hours: 0 },
        { date: '2026-11-06', hours: 0 },
        { date: '2026-11-07', hours: 0 },
        { date: '2026-11-08', hours: 0 }
      ],
      clients: []
    });
  });

  test('sets overLimit above 40 hours but not at exactly 40 hours', async () => {
    const userEmail = 'weekly-limit@example.com';
    const clientId = await createClient(userEmail, 'Limit Client');
    for (const [date, hours] of [
      ['2026-10-26', 7],
      ['2026-10-27', 7],
      ['2026-10-28', 7],
      ['2026-10-29', 7],
      ['2026-10-30', 7],
      ['2026-10-31', 7]
    ]) {
      await createWorkEntry(userEmail, clientId, date, hours);
    }

    const overLimitResponse = await getWeeklyReport(userEmail);
    expect(overLimitResponse.body.totalHours).toBe(42);
    expect(overLimitResponse.body.overLimit).toBe(true);

    const exactUser = 'weekly-exact-limit@example.com';
    const exactClientId = await createClient(exactUser, 'Exact Limit Client');
    await createWorkEntry(exactUser, exactClientId, '2026-10-26', 24);
    await createWorkEntry(exactUser, exactClientId, '2026-10-27', 16);

    const exactResponse = await getWeeklyReport(exactUser);
    expect(exactResponse.body.totalHours).toBe(40);
    expect(exactResponse.body.overLimit).toBe(false);
  });

  test('excludes work entries after their client is deleted', async () => {
    const userEmail = 'weekly-deleted-client@example.com';
    const clientId = await createClient(userEmail, 'Deleted Client');
    await createWorkEntry(userEmail, clientId, '2026-10-26', 21);
    await createWorkEntry(userEmail, clientId, '2026-10-27', 20);

    const beforeDelete = await getWeeklyReport(userEmail);
    expect(beforeDelete.body.totalHours).toBe(41);
    expect(beforeDelete.body.overLimit).toBe(true);

    const deleteResponse = await request(app)
      .delete(`/api/clients/${clientId}`)
      .set('x-user-email', userEmail);
    expect(deleteResponse.status).toBe(200);

    const afterDelete = await getWeeklyReport(userEmail);
    expect(afterDelete.status).toBe(200);
    expect(afterDelete.body.totalHours).toBe(0);
    expect(afterDelete.body.overLimit).toBe(false);
    expect(afterDelete.body.clients).toEqual([]);
    expect(afterDelete.body.days).toHaveLength(7);
    expect(afterDelete.body.days.map((day) => day.hours)).toEqual(Array(7).fill(0));
  });

  test('isolates totals and client breakdowns by authenticated user', async () => {
    const firstUser = 'weekly-first-user@example.com';
    const secondUser = 'weekly-second-user@example.com';
    const firstClientId = await createClient(firstUser, 'First User Client');
    const secondClientId = await createClient(secondUser, 'Second User Client');
    await createWorkEntry(firstUser, firstClientId, '2026-10-26', 5);
    await createWorkEntry(secondUser, secondClientId, '2026-10-26', 11);

    const firstResponse = await getWeeklyReport(firstUser);
    const secondResponse = await getWeeklyReport(secondUser);

    expect(firstResponse.body.totalHours).toBe(5);
    expect(firstResponse.body.clients).toEqual([
      { clientId: firstClientId, clientName: 'First User Client', hours: 5 }
    ]);
    expect(secondResponse.body.totalHours).toBe(11);
    expect(secondResponse.body.clients).toEqual([
      { clientId: secondClientId, clientName: 'Second User Client', hours: 11 }
    ]);
  });

  test.each([
    ['missing weekStart', undefined],
    ['not-a-date', 'not-a-date'],
    ['an impossible date', '2026-02-30'],
    ['a Tuesday', '2026-10-27'],
    ['a non-ISO date', '10/26/2026']
  ])('returns a 400 error for %s', async (_description, week) => {
    let response = request(app).get('/api/reports/weekly').set('x-user-email', 'weekly-invalid@example.com');
    if (week !== undefined) {
      response = response.query({ weekStart: week });
    }

    const result = await response;
    expect(result.status).toBe(400);
    expect(typeof result.body.error).toBe('string');
  });

  test('requires the authenticated user header', async () => {
    const response = await request(app)
      .get('/api/reports/weekly')
      .query({ weekStart });

    expect(response.status).toBe(401);
    expect(response.body.error).toBeTruthy();
  });
});
