jest.unmock('sqlite3');

const express = require('express');
const request = require('supertest');
const { initializeDatabase, closeDatabase } = require('../../database/init');
const { errorHandler } = require('../../middleware/errorHandler');
const { lineAmountCents, taxCents, computeTotals } = require('../../services/invoices');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/clients', require('../../routes/clients'));
  app.use('/api/work-entries', require('../../routes/workEntries'));
  app.use('/api/reports', require('../../routes/reports'));
  app.use('/api/billing-profile', require('../../routes/billingProfile'));
  app.use('/api/invoices', require('../../routes/invoices'));
  app.use(errorHandler);
  return app;
}

let app;
let userCounter = 0;

beforeAll(async () => {
  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(console, 'error').mockImplementation();
  await initializeDatabase();
  app = buildApp();
});

afterAll(async () => {
  await closeDatabase();
});

function asUser(email) {
  const h = { 'x-user-email': email };
  return {
    get: (url) => request(app).get(url).set(h),
    post: (url, body) => request(app).post(url).set(h).send(body),
    put: (url, body) => request(app).put(url).set(h).send(body),
    del: (url) => request(app).delete(url).set(h),
  };
}

async function setup({ rate = 10000, entries = [['2026-06-01', 2], ['2026-06-02', 1.5]] } = {}) {
  userCounter += 1;
  const user = asUser(`user${userCounter}@example.com`);
  const client = (await user.post('/api/clients', { name: 'Acme', hourlyRateCents: rate, currency: 'EUR' })).body.client;
  const workEntries = [];
  for (const [date, hours] of entries) {
    workEntries.push((await user.post('/api/work-entries', { clientId: client.id, hours, date, description: `Work ${date}` })).body.workEntry);
  }
  return { user, client, workEntries };
}

async function createDraft(user, client, workEntries, extra = {}) {
  return user.post('/api/invoices', {
    clientId: client.id,
    issueDate: '2026-07-01',
    lines: workEntries.map((e) => ({ workEntryId: e.id })),
    ...extra,
  });
}

describe('money calculations', () => {
  test('round half up in integer cents', () => {
    expect(lineAmountCents(1.5, 3333)).toBe(5000); // 4999.5 -> 5000
    expect(lineAmountCents(0.1, 5)).toBe(1); // 0.5 -> 1
    expect(lineAmountCents(2, null)).toBe(0);
    expect(taxCents(1005, 1000)).toBe(101); // 100.5 -> 101
    expect(computeTotals([{ quantity: 1.25, unitPriceCents: 9999 }], 825))
      .toEqual({ subtotalCents: 12499, taxCents: 1031, totalCents: 13530 });
  });
});

describe('client billing fields', () => {
  test('are saved and returned', async () => {
    const { user, client } = await setup();
    expect(client).toMatchObject({ hourly_rate_cents: 10000, currency: 'EUR' });
    const res = await user.put(`/api/clients/${client.id}`, { billingAddress: '1 Main St', paymentTermsDays: 14 });
    expect(res.body.client).toMatchObject({ billing_address: '1 Main St', payment_terms_days: 14 });
  });
});

describe('billing profile', () => {
  test('returns defaults, then saves changes', async () => {
    const { user } = await setup({ entries: [] });
    expect((await user.get('/api/billing-profile')).body.billingProfile)
      .toMatchObject({ invoice_prefix: 'INV', default_currency: 'USD', default_payment_terms_days: 30 });
    const res = await user.put('/api/billing-profile', { businessName: 'Me LLC', invoicePrefix: 'ME', defaultTaxRateBp: 2000 });
    expect(res.body.billingProfile).toMatchObject({ business_name: 'Me LLC', invoice_prefix: 'ME', default_tax_rate_bp: 2000 });
    expect((await user.put('/api/billing-profile', { invoicePrefix: 'bad prefix!' })).status).toBe(400);
  });
});

describe('draft invoices', () => {
  test('preview lists unbilled entries with client defaults', async () => {
    const { user, client } = await setup();
    const res = await user.get(`/api/invoices/preview?clientId=${client.id}&from=2026-06-02`);
    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.defaults).toMatchObject({ currency: 'EUR', hourlyRateCents: 10000 });
  });

  test('create computes totals server-side and reserves entries', async () => {
    const { user, client, workEntries } = await setup();
    const res = await createDraft(user, client, workEntries, {
      taxRateBp: 1000,
      lines: [
        { workEntryId: workEntries[0].id },
        { workEntryId: workEntries[1].id, unitPriceCents: 5000 },
        { description: 'Expenses', quantity: 1, unitPriceCents: 1234 },
      ],
    });
    expect(res.status).toBe(201);
    const inv = res.body.invoice;
    expect(inv).toMatchObject({ status: 'draft', invoice_number: null, currency: 'EUR', due_date: '2026-07-31' });
    expect(inv.lines.map((l) => l.amount_cents)).toEqual([20000, 7500, 1234]);
    expect(inv).toMatchObject({ subtotal_cents: 28734, tax_cents: 2873, total_cents: 31607 });

    const entries = (await user.get('/api/work-entries?billed=true')).body.workEntries;
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ invoice_id: inv.id, invoice_status: 'draft' });
  });

  test('prevents double billing, including concurrent requests', async () => {
    const { user, client, workEntries } = await setup();
    const results = await Promise.all([
      createDraft(user, client, workEntries),
      createDraft(user, client, workEntries),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await createDraft(user, client, [workEntries[0]])).status).toBe(409);
    const list = (await user.get('/api/invoices')).body;
    expect(list.pagination.total).toBe(1);
  });

  test('rejects entries from other clients or users', async () => {
    const a = await setup();
    const b = await setup();
    expect((await createDraft(a.user, a.client, b.workEntries)).status).toBe(400);
    const other = (await a.user.post('/api/clients', { name: 'Other' })).body.client;
    expect((await createDraft(a.user, other, a.workEntries)).status).toBe(400);
    expect((await a.user.post('/api/invoices', { clientId: b.client.id })).status).toBe(400);
  });

  test('validates dates and bodies', async () => {
    const { user, client } = await setup();
    expect((await user.post('/api/invoices', { clientId: client.id, issueDate: '2026-07-10', dueDate: '2026-07-01' })).status).toBe(400);
    expect((await user.post('/api/invoices', { clientId: client.id, periodStart: '2026-07-10', periodEnd: '2026-07-01' })).status).toBe(400);
    expect((await user.post('/api/invoices', { clientId: client.id, lines: [{ quantity: 1 }] })).status).toBe(400);
    expect((await user.post('/api/invoices', {})).status).toBe(400);
    expect((await user.get('/api/invoices/abc')).status).toBe(400);
  });

  test('update replaces lines and releases removed entries', async () => {
    const { user, client, workEntries } = await setup();
    const inv = (await createDraft(user, client, workEntries)).body.invoice;
    const res = await user.put(`/api/invoices/${inv.id}`, { lines: [{ workEntryId: workEntries[0].id }], notes: 'Thanks' });
    expect(res.status).toBe(200);
    expect(res.body.invoice.lines).toHaveLength(1);
    expect(res.body.invoice.notes).toBe('Thanks');
    expect((await user.get('/api/work-entries?billed=false')).body.workEntries.map((e) => e.id)).toEqual([workEntries[1].id]);

    const keep = await user.put(`/api/invoices/${inv.id}`, { taxRateBp: 500 });
    expect(keep.body.invoice.lines).toHaveLength(1);
    expect(keep.body.invoice.tax_cents).toBe(1000);
  });

  test('delete releases entries; other users get 404', async () => {
    const { user, client, workEntries } = await setup();
    const inv = (await createDraft(user, client, workEntries)).body.invoice;
    const stranger = asUser('stranger@example.com');
    expect((await stranger.get(`/api/invoices/${inv.id}`)).status).toBe(404);
    expect((await stranger.del(`/api/invoices/${inv.id}`)).status).toBe(404);
    expect((await user.del(`/api/invoices/${inv.id}`)).status).toBe(200);
    expect((await user.get('/api/work-entries?billed=true')).body.workEntries).toHaveLength(0);
  });
});

describe('lifecycle', () => {
  test('issue assigns sequential per-user numbers and snapshots', async () => {
    const { user, client, workEntries } = await setup();
    await user.put('/api/billing-profile', { businessName: 'Me LLC' });
    const first = (await createDraft(user, client, [workEntries[0]])).body.invoice;
    const second = (await createDraft(user, client, [workEntries[1]])).body.invoice;
    const issued1 = await user.post(`/api/invoices/${first.id}/issue`);
    const issued2 = await user.post(`/api/invoices/${second.id}/issue`);
    expect(issued1.body.invoice).toMatchObject({ status: 'issued', invoice_number: 'INV-0001' });
    expect(issued1.body.invoice.sender_snapshot.name).toBe('Me LLC');
    expect(issued1.body.invoice.client_snapshot.name).toBe('Acme');
    expect(issued2.body.invoice.invoice_number).toBe('INV-0002');

    const other = await setup();
    const otherInv = (await createDraft(other.user, other.client, other.workEntries)).body.invoice;
    expect((await other.user.post(`/api/invoices/${otherInv.id}/issue`)).body.invoice.invoice_number).toBe('INV-0001');

    // Snapshots do not change when the client is renamed later
    await user.put(`/api/clients/${client.id}`, { name: 'Renamed' });
    expect((await user.get(`/api/invoices/${first.id}`)).body.invoice.client_snapshot.name).toBe('Acme');
  });

  test('issue requires lines and rates', async () => {
    const { user, client, workEntries } = await setup({ rate: null });
    const empty = (await user.post('/api/invoices', { clientId: client.id })).body.invoice;
    expect((await user.post(`/api/invoices/${empty.id}/issue`)).status).toBe(422);
    const noRate = (await createDraft(user, client, workEntries)).body.invoice;
    expect((await user.post(`/api/invoices/${noRate.id}/issue`)).status).toBe(422);
  });

  test('state machine: issued is locked, paid/unpaid toggles, void releases entries', async () => {
    const { user, client, workEntries } = await setup();
    const inv = (await createDraft(user, client, workEntries)).body.invoice;
    expect((await user.post(`/api/invoices/${inv.id}/void`, { reason: 'x' })).status).toBe(409);
    expect((await user.post(`/api/invoices/${inv.id}/mark-paid`)).status).toBe(409);
    await user.post(`/api/invoices/${inv.id}/issue`);

    expect((await user.post(`/api/invoices/${inv.id}/issue`)).status).toBe(409);
    expect((await user.put(`/api/invoices/${inv.id}`, { notes: 'edit' })).status).toBe(409);
    expect((await user.del(`/api/invoices/${inv.id}`)).status).toBe(409);
    expect((await user.put(`/api/work-entries/${workEntries[0].id}`, { hours: 5 })).status).toBe(409);
    expect((await user.del(`/api/work-entries/${workEntries[0].id}`)).status).toBe(409);
    expect((await user.del(`/api/clients/${client.id}`)).status).toBe(409);
    expect((await user.del('/api/clients')).status).toBe(409);

    const paid = await user.post(`/api/invoices/${inv.id}/mark-paid`, { paidDate: '2026-07-05' });
    expect(paid.body.invoice).toMatchObject({ status: 'paid', paid_at: '2026-07-05' });
    expect((await user.post(`/api/invoices/${inv.id}/mark-unpaid`)).body.invoice).toMatchObject({ status: 'issued', paid_at: null });

    expect((await user.post(`/api/invoices/${inv.id}/void`, {})).status).toBe(400);
    const voided = await user.post(`/api/invoices/${inv.id}/void`, { reason: 'Wrong rate' });
    expect(voided.body.invoice).toMatchObject({ status: 'void', void_reason: 'Wrong rate', invoice_number: 'INV-0001' });
    expect((await user.post(`/api/invoices/${inv.id}/void`, { reason: 'again' })).status).toBe(409);

    // Entries are free again and can go on a replacement invoice with a new number
    const replacement = (await createDraft(user, client, workEntries)).body.invoice;
    expect((await user.post(`/api/invoices/${replacement.id}/issue`)).body.invoice.invoice_number).toBe('INV-0002');
  });

  test('list filters, overdue and currency summary', async () => {
    const { user, client, workEntries } = await setup();
    const inv = (await createDraft(user, client, [workEntries[0]], { issueDate: '2020-01-01', dueDate: '2020-01-31' })).body.invoice;
    await user.post(`/api/invoices/${inv.id}/issue`);
    await createDraft(user, client, [workEntries[1]]);

    const overdue = (await user.get('/api/invoices?status=overdue')).body;
    expect(overdue.invoices).toHaveLength(1);
    expect(overdue.invoices[0].is_overdue).toBe(true);
    expect(overdue.summary).toEqual([expect.objectContaining({ currency: 'EUR', outstanding_cents: 20000, overdue_cents: 20000, draft_cents: 15000 })]);
    expect((await user.get(`/api/invoices?status=draft&clientId=${client.id}&from=2026-01-01&to=2026-12-31`)).body.invoices).toHaveLength(1);
    expect((await user.get('/api/invoices?page=2&pageSize=1')).body.invoices).toHaveLength(1);
    expect((await user.get('/api/invoices?status=bogus')).status).toBe(400);
  });

  test('pdf streams for draft and issued invoices', async () => {
    const { user, client, workEntries } = await setup();
    const inv = (await createDraft(user, client, workEntries, { notes: 'Pay by transfer' })).body.invoice;
    const draftPdf = await user.get(`/api/invoices/${inv.id}/pdf`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(draftPdf.status).toBe(200);
    expect(draftPdf.headers['content-type']).toBe('application/pdf');
    expect(draftPdf.headers['content-disposition']).toContain(`invoice-draft-${inv.id}-Acme.pdf`);
    expect(draftPdf.body.slice(0, 4).toString()).toBe('%PDF');
    expect(draftPdf.body.toString('latin1').match(/\/Type \/Page\b(?!s)/g)).toHaveLength(1);

    await user.post(`/api/invoices/${inv.id}/issue`);
    const issuedPdf = await user.get(`/api/invoices/${inv.id}/pdf`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(issuedPdf.body.toString('latin1').match(/\/Type \/Page\b(?!s)/g)).toHaveLength(1);
    expect(issuedPdf.headers['content-disposition']).toContain('invoice-INV-0001-Acme.pdf');
  });

  test('reports include unbilled hours and amount', async () => {
    const { user, client, workEntries } = await setup();
    await createDraft(user, client, [workEntries[0]]);
    const report = (await user.get(`/api/reports/client/${client.id}`)).body;
    expect(report).toMatchObject({ totalHours: 3.5, unbilledHours: 1.5, unbilledEntryCount: 1, unbilledAmountCents: 15000 });
  });
});
