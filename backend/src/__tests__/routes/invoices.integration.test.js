// Runs against a real in-memory SQLite database to exercise transactions,
// constraints, and joins that the mocked route tests cannot cover.
jest.unmock('sqlite3');

const request = require('supertest');
const express = require('express');
const { initializeDatabase, getDatabase } = require('../../database/init');
const { authenticateUser } = require('../../middleware/auth');
const { errorHandler } = require('../../middleware/errorHandler');
const clientRoutes = require('../../routes/clients');
const workEntryRoutes = require('../../routes/workEntries');
const invoiceRoutes = require('../../routes/invoices');

const app = express();
app.use(express.json());
app.use('/api/clients', authenticateUser, clientRoutes);
app.use('/api/work-entries', authenticateUser, workEntryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use(errorHandler);

function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    getDatabase().run(sql, params, function(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID });
    });
  });
}

const PERIOD = { periodStart: '2026-09-01', periodEnd: '2026-09-30' };
let userCounter = 0;

function api(email) {
  const withAuth = (req) => req.set('x-user-email', email);
  return {
    get: (url) => withAuth(request(app).get(url)),
    post: (url, body) => withAuth(request(app).post(url)).send(body),
    put: (url, body) => withAuth(request(app).put(url)).send(body),
    patch: (url, body) => withAuth(request(app).patch(url)).send(body),
    delete: (url) => withAuth(request(app).delete(url))
  };
}

async function setupUser({ hourlyRate = 150, entries = [] } = {}) {
  userCounter += 1;
  const email = `user${userCounter}@example.com`;
  const client = api(email);
  const created = await client.post('/api/clients', {
    name: 'Acme Corp',
    email: 'billing@acme.com',
    hourlyRate,
    currency: 'EUR',
    billingAddress: '1 Main St\nSpringfield'
  });
  expect(created.status).toBe(201);
  const clientId = created.body.client.id;
  const entryIds = [];
  // Seeded directly: under Jest's VM realm sqlite3 cannot bind the Date objects the
  // work entry route receives from Joi, so store epoch milliseconds as production does.
  for (const entry of entries) {
    const { lastID } = await dbRun(
      'INSERT INTO work_entries (client_id, user_email, hours, description, date) VALUES (?, ?, ?, ?, ?)',
      [clientId, email, entry.hours, entry.description, Date.parse(entry.date)]
    );
    entryIds.push(lastID);
  }
  return { client, clientId, entryIds };
}

const SEPT_ENTRIES = [
  { hours: 2.5, date: '2026-09-01', description: 'Kickoff' },
  { hours: 1.33, date: '2026-09-30', description: 'Review' },
  { hours: 4, date: '2026-10-01', description: 'Next month' }
];

beforeAll(async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await initializeDatabase();
});

afterAll(() => {
  console.error.mockRestore();
});

describe('Invoice routes (real SQLite)', () => {
  test('enables foreign key enforcement', async () => {
    const row = await new Promise((resolve, reject) => {
      getDatabase().get('PRAGMA foreign_keys', [], (err, r) => (err ? reject(err) : resolve(r)));
    });
    expect(row.foreign_keys).toBe(1);
  });

  test('client billing fields round-trip as decimals', async () => {
    const { client, clientId } = await setupUser({ hourlyRate: 99.99 });
    const res = await client.get(`/api/clients/${clientId}`);
    expect(res.body.client).toMatchObject({
      hourly_rate: 99.99,
      currency: 'EUR',
      billing_address: '1 Main St\nSpringfield'
    });

    const updated = await client.put(`/api/clients/${clientId}`, { hourlyRate: null, currency: 'usd' });
    expect(updated.body.client).toMatchObject({ hourly_rate: null, currency: 'USD' });
  });

  test('preview lists unbilled entries in the inclusive period without writing', async () => {
    const { client, clientId } = await setupUser({ entries: SEPT_ENTRIES });
    const res = await client.get(
      `/api/invoices/preview?clientId=${clientId}&periodStart=${PERIOD.periodStart}&periodEnd=${PERIOD.periodEnd}`
    );
    expect(res.status).toBe(200);
    expect(res.body.lineItems.map((item) => item.entry_date)).toEqual(['2026-09-01', '2026-09-30']);
    // 2.5 * 150 = 375.00; 1.33 * 150 = 199.50
    expect(res.body.lineItems.map((item) => item.amount)).toEqual([375, 199.5]);
    expect(res.body).toMatchObject({ subtotal: 574.5, total: 574.5, totalHours: 3.83, currency: 'EUR' });

    const list = await client.get('/api/invoices');
    expect(list.body.invoices).toHaveLength(0);
  });

  test('creates an invoice, snapshots data, and marks entries as billed', async () => {
    const { client, clientId, entryIds } = await setupUser({ entries: SEPT_ENTRIES });
    const res = await client.post('/api/invoices', { clientId, ...PERIOD, dueDate: '2026-10-31', notes: 'Thanks' });
    expect(res.status).toBe(201);
    const year = new Date().getUTCFullYear();
    expect(res.body.invoice).toMatchObject({
      invoice_number: `INV-${year}-0001`,
      status: 'draft',
      client_name: 'Acme Corp',
      currency: 'EUR',
      total: 574.5,
      total_hours: 3.83,
      due_date: '2026-10-31',
      notes: 'Thanks'
    });
    expect(res.body.lineItems).toHaveLength(2);

    const entries = await client.get('/api/work-entries');
    const byId = Object.fromEntries(entries.body.workEntries.map((e) => [e.id, e]));
    expect(byId[entryIds[0]]).toMatchObject({ invoice_number: `INV-${year}-0001`, invoice_status: 'draft' });
    expect(byId[entryIds[2]]).toMatchObject({ invoice_id: null, invoice_number: null });

    // Snapshot: later client edits do not change the invoice
    await client.put(`/api/clients/${clientId}`, { name: 'Renamed', hourlyRate: 500 });
    const detail = await client.get(`/api/invoices/${res.body.invoice.id}`);
    expect(detail.body.invoice.client_name).toBe('Acme Corp');
    expect(detail.body.lineItems[0].rate).toBe(150);
  });

  test('returns 422 when client has no hourly rate', async () => {
    const { client, clientId } = await setupUser({ hourlyRate: null, entries: SEPT_ENTRIES });
    const res = await client.post('/api/invoices', { clientId, ...PERIOD });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'Client has no hourly rate configured' });
  });

  test('returns 422 when there are no unbilled entries', async () => {
    const { client, clientId } = await setupUser({ entries: SEPT_ENTRIES });
    await client.post('/api/invoices', { clientId, ...PERIOD });
    const res = await client.post('/api/invoices', { clientId, ...PERIOD });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'No unbilled work entries in the selected period' });
  });

  test('returns 409 when selected entries are already billed', async () => {
    const { client, clientId, entryIds } = await setupUser({ entries: SEPT_ENTRIES });
    await client.post('/api/invoices', { clientId, ...PERIOD, workEntryIds: [entryIds[0]] });
    const res = await client.post('/api/invoices', { clientId, ...PERIOD, workEntryIds: [entryIds[0], entryIds[1]] });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'One or more work entries are already billed' });
  });

  test('concurrent creation bills each entry at most once', async () => {
    const { client, clientId } = await setupUser({ entries: SEPT_ENTRIES });
    const results = await Promise.all([
      client.post('/api/invoices', { clientId, ...PERIOD }),
      client.post('/api/invoices', { clientId, ...PERIOD })
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
  });

  test('rejects workEntryIds outside the client or period', async () => {
    const { client, clientId, entryIds } = await setupUser({ entries: SEPT_ENTRIES });
    const res = await client.post('/api/invoices', { clientId, ...PERIOD, workEntryIds: [entryIds[2]] });
    expect(res.status).toBe(422);
  });

  test('validates request bodies', async () => {
    const { client, clientId } = await setupUser();
    const res = await client.post('/api/invoices', { clientId, periodStart: '2026-09-30', periodEnd: '2026-09-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');

    const badRate = await client.post('/api/clients', { name: 'X', hourlyRate: -1 });
    expect(badRate.status).toBe(400);
  });

  test('blocks editing and deleting billed work entries', async () => {
    const { client, clientId, entryIds } = await setupUser({ entries: SEPT_ENTRIES });
    const created = await client.post('/api/invoices', { clientId, ...PERIOD });
    const number = created.body.invoice.invoice_number;

    const edit = await client.put(`/api/work-entries/${entryIds[0]}`, { hours: 9 });
    expect(edit.status).toBe(409);
    expect(edit.body.error).toContain(number);

    const del = await client.delete(`/api/work-entries/${entryIds[0]}`);
    expect(del.status).toBe(409);

    const unbilledEdit = await client.put(`/api/work-entries/${entryIds[2]}`, { hours: 5 });
    expect(unbilledEdit.status).toBe(200);
  });

  test('enforces status transitions and sets issue date', async () => {
    const { client, clientId } = await setupUser({ entries: SEPT_ENTRIES });
    const { body } = await client.post('/api/invoices', { clientId, ...PERIOD });
    const id = body.invoice.id;

    const badJump = await client.patch(`/api/invoices/${id}/status`, { status: 'paid' });
    expect(badJump.status).toBe(409);

    const issued = await client.patch(`/api/invoices/${id}/status`, { status: 'issued' });
    expect(issued.status).toBe(200);
    expect(issued.body.invoice.issue_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const del = await client.delete(`/api/invoices/${id}`);
    expect(del.status).toBe(409);

    const paid = await client.patch(`/api/invoices/${id}/status`, { status: 'paid' });
    expect(paid.body.invoice.status).toBe('paid');

    const afterPaid = await client.patch(`/api/invoices/${id}/status`, { status: 'void' });
    expect(afterPaid.status).toBe(409);

    const invalid = await client.patch(`/api/invoices/${id}/status`, { status: 'draft' });
    expect(invalid.status).toBe(400);
  });

  test('voiding archives lines and releases entries for rebilling', async () => {
    const { client, clientId, entryIds } = await setupUser({ entries: SEPT_ENTRIES });
    const first = await client.post('/api/invoices', { clientId, ...PERIOD });
    const id = first.body.invoice.id;
    await client.patch(`/api/invoices/${id}/status`, { status: 'issued' });

    const voided = await client.patch(`/api/invoices/${id}/status`, { status: 'void' });
    expect(voided.body.invoice.status).toBe('void');

    const detail = await client.get(`/api/invoices/${id}`);
    expect(detail.body.lineItems.map((item) => item.work_entry_id)).toEqual([entryIds[0], entryIds[1]]);

    const second = await client.post('/api/invoices', { clientId, ...PERIOD });
    expect(second.status).toBe(201);
    expect(second.body.invoice.invoice_number).not.toBe(first.body.invoice.invoice_number);
  });

  test('deleting a draft releases entries and never reuses its number', async () => {
    const { client, clientId } = await setupUser({ entries: SEPT_ENTRIES });
    const first = await client.post('/api/invoices', { clientId, ...PERIOD });
    const del = await client.delete(`/api/invoices/${first.body.invoice.id}`);
    expect(del.status).toBe(200);

    const second = await client.post('/api/invoices', { clientId, ...PERIOD });
    expect(second.status).toBe(201);
    expect(second.body.invoice.invoice_number).toMatch(/-0002$/);
  });

  test('blocks deleting clients that have non-void invoices', async () => {
    const { client, clientId } = await setupUser({ entries: SEPT_ENTRIES });
    const { body } = await client.post('/api/invoices', { clientId, ...PERIOD });

    expect((await client.delete(`/api/clients/${clientId}`)).status).toBe(409);
    expect((await client.delete('/api/clients')).status).toBe(409);

    await client.patch(`/api/invoices/${body.invoice.id}/status`, { status: 'void' });
    expect((await client.delete(`/api/clients/${clientId}`)).status).toBe(200);
  });

  test('isolates invoices between users', async () => {
    const owner = await setupUser({ entries: SEPT_ENTRIES });
    const other = await setupUser();
    const { body } = await owner.client.post('/api/invoices', { clientId: owner.clientId, ...PERIOD });
    const id = body.invoice.id;

    expect((await other.client.get(`/api/invoices/${id}`)).status).toBe(404);
    expect((await other.client.get(`/api/invoices/${id}/pdf`)).status).toBe(404);
    expect((await other.client.patch(`/api/invoices/${id}/status`, { status: 'issued' })).status).toBe(404);
    expect((await other.client.delete(`/api/invoices/${id}`)).status).toBe(404);
    expect((await other.client.get('/api/invoices')).body.invoices).toHaveLength(0);
    const preview = await other.client.get(
      `/api/invoices/preview?clientId=${owner.clientId}&periodStart=${PERIOD.periodStart}&periodEnd=${PERIOD.periodEnd}`
    );
    expect(preview.status).toBe(404);
  });

  test('filters the invoice list by status and client', async () => {
    const { client, clientId } = await setupUser({ entries: SEPT_ENTRIES });
    const { body } = await client.post('/api/invoices', { clientId, ...PERIOD });
    expect((await client.get('/api/invoices?status=draft')).body.invoices).toHaveLength(1);
    expect((await client.get('/api/invoices?status=paid')).body.invoices).toHaveLength(0);
    expect((await client.get(`/api/invoices?clientId=${clientId}`)).body.invoices[0].id).toBe(body.invoice.id);
    expect((await client.get('/api/invoices?status=bogus')).status).toBe(400);
  });

  test('downloads a PDF with a sanitized filename', async () => {
    const { client, clientId } = await setupUser({ entries: SEPT_ENTRIES });
    const { body } = await client.post('/api/invoices', { clientId, ...PERIOD });
    const res = await client.get(`/api/invoices/${body.invoice.id}/pdf`).buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="${body.invoice.invoice_number}.pdf"`);
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });
});
