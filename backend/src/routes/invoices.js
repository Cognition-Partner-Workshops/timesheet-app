const express = require('express');
const PDFDocument = require('pdfkit');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const {
  createInvoiceSchema,
  invoicePreviewQuerySchema,
  invoiceListQuerySchema,
  updateInvoiceStatusSchema
} = require('../validation/schemas');
const {
  DAY_MS,
  fromCents,
  toHundredths,
  lineAmountCents,
  toIsoDate,
  formatMoney
} = require('../utils/billing');

const router = express.Router();

router.use(authenticateUser);

const STATUS_TRANSITIONS = {
  draft: ['issued', 'void'],
  issued: ['paid', 'void'],
  paid: [],
  void: []
};

const LINE_ITEM_COLUMNS = 'id, work_entry_id, entry_date, description, hours, rate_cents, amount_cents';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

// All requests share one SQLite connection, so invoice write transactions are
// serialized in-process to keep them from interleaving with each other.
let writeQueue = Promise.resolve();
function runExclusive(task) {
  const result = writeQueue.then(task);
  writeQueue = result.catch(() => {});
  return result;
}

async function withTransaction(db, work) {
  await run(db, 'BEGIN IMMEDIATE');
  try {
    const result = await work();
    await run(db, 'COMMIT');
    return result;
  } catch (err) {
    await run(db, 'ROLLBACK').catch(() => {});
    throw err;
  }
}

function handleError(err, res, next) {
  if (err.isJoi) return next(err);
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.code === 'SQLITE_CONSTRAINT' && /invoice_line_items\.work_entry_id/.test(err.message)) {
    return res.status(409).json({ error: 'One or more work entries are already billed' });
  }
  console.error('Database error:', err);
  return res.status(500).json({ error: 'Internal server error' });
}

function parseId(value) {
  const id = parseInt(value);
  if (isNaN(id)) throw new HttpError(400, 'Invalid invoice ID');
  return id;
}

function validate(schema, payload) {
  const { error, value } = schema.validate(payload);
  if (error) throw error;
  return value;
}

function formatInvoice(row) {
  return {
    id: row.id,
    client_id: row.client_id,
    invoice_number: row.invoice_number,
    status: row.status,
    period_start: row.period_start,
    period_end: row.period_end,
    issue_date: row.issue_date,
    due_date: row.due_date,
    client_name: row.client_name,
    client_email: row.client_email,
    billing_address: row.billing_address,
    currency: row.currency,
    subtotal: fromCents(row.subtotal_cents),
    total: fromCents(row.total_cents),
    total_hours: row.total_hours,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function formatLineItem(row) {
  return {
    id: row.id,
    work_entry_id: row.work_entry_id,
    entry_date: row.entry_date,
    description: row.description,
    hours: row.hours,
    rate: fromCents(row.rate_cents),
    amount: fromCents(row.amount_cents)
  };
}

async function getOwnedInvoice(db, userEmail, invoiceId) {
  const invoice = await get(db, 'SELECT * FROM invoices WHERE id = ? AND user_email = ?', [invoiceId, userEmail]);
  if (!invoice) throw new HttpError(404, 'Invoice not found');
  return invoice;
}

async function getInvoiceLineItems(db, userEmail, invoice) {
  const table = invoice.status === 'void' ? 'invoice_line_items_archive' : 'invoice_line_items';
  return all(
    db,
    `SELECT ${LINE_ITEM_COLUMNS} FROM ${table} WHERE invoice_id = ? AND user_email = ? ORDER BY entry_date ASC, id ASC`,
    [invoice.id, userEmail]
  );
}

// Builds the would-be invoice contents from the user's unbilled entries. Performs no writes.
async function buildInvoiceDraft(db, userEmail, { clientId, periodStart, periodEnd, workEntryIds }) {
  const client = await get(
    db,
    `SELECT id, name, email, billing_address, currency, hourly_rate
     FROM clients WHERE id = ? AND user_email = ?`,
    [clientId, userEmail]
  );
  if (!client) throw new HttpError(404, 'Client not found');
  if (client.hourly_rate === null || client.hourly_rate === undefined) {
    throw new HttpError(422, 'Client has no hourly rate configured');
  }

  const rangeStart = periodStart.getTime();
  const rangeEndExclusive = periodEnd.getTime() + DAY_MS;

  const unbilled = await all(
    db,
    `SELECT we.id, we.date, we.description, we.hours
     FROM work_entries we
     LEFT JOIN invoice_line_items ili ON ili.work_entry_id = we.id AND ili.user_email = ?
     WHERE we.user_email = ? AND we.client_id = ? AND we.date >= ? AND we.date < ?
       AND ili.id IS NULL
     ORDER BY we.date ASC, we.id ASC`,
    [userEmail, userEmail, clientId, rangeStart, rangeEndExclusive]
  );

  let entries = unbilled;
  if (workEntryIds) {
    const unbilledIds = new Set(unbilled.map((entry) => entry.id));
    const missing = workEntryIds.filter((id) => !unbilledIds.has(id));
    if (missing.length > 0) {
      const placeholders = missing.map(() => '?').join(', ');
      const billed = await get(
        db,
        `SELECT COUNT(*) AS count FROM invoice_line_items
         WHERE user_email = ? AND work_entry_id IN (${placeholders})`,
        [userEmail, ...missing]
      );
      if (billed.count > 0) throw new HttpError(409, 'One or more work entries are already billed');
      throw new HttpError(422, 'One or more work entries do not belong to this client and period');
    }
    const requested = new Set(workEntryIds);
    entries = unbilled.filter((entry) => requested.has(entry.id));
  }

  const rateCents = client.hourly_rate;
  const lineItems = entries.map((entry) => ({
    work_entry_id: entry.id,
    entry_date: toIsoDate(entry.date),
    description: entry.description,
    hours: entry.hours,
    rate_cents: rateCents,
    amount_cents: lineAmountCents(entry.hours, rateCents)
  }));
  const subtotalCents = lineItems.reduce((sum, item) => sum + item.amount_cents, 0);
  const totalHours = lineItems.reduce((sum, item) => sum + toHundredths(item.hours), 0) / 100;

  return { client, lineItems, subtotalCents, totalCents: subtotalCents, totalHours };
}

async function nextInvoiceNumber(db, userEmail) {
  const year = new Date().getUTCFullYear();
  await run(
    db,
    `INSERT INTO invoice_sequences (user_email, year, next_value) VALUES (?, ?, 1)
     ON CONFLICT (user_email, year) DO UPDATE SET next_value = next_value + 1`,
    [userEmail, year]
  );
  const row = await get(
    db,
    'SELECT next_value FROM invoice_sequences WHERE user_email = ? AND year = ?',
    [userEmail, year]
  );
  return `INV-${year}-${String(row.next_value).padStart(4, '0')}`;
}

// List invoices
router.get('/', async (req, res, next) => {
  try {
    const filters = validate(invoiceListQuerySchema, req.query);
    const db = getDatabase();
    let query = 'SELECT * FROM invoices WHERE user_email = ?';
    const params = [req.userEmail];
    if (filters.clientId) {
      query += ' AND client_id = ?';
      params.push(filters.clientId);
    }
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    query += ' ORDER BY created_at DESC, id DESC';
    const rows = await all(db, query, params);
    res.json({ invoices: rows.map(formatInvoice) });
  } catch (err) {
    handleError(err, res, next);
  }
});

// Dry-run of invoice generation
router.get('/preview', async (req, res, next) => {
  try {
    const params = validate(invoicePreviewQuerySchema, req.query);
    const db = getDatabase();
    const draft = await buildInvoiceDraft(db, req.userEmail, params);
    res.json({
      client: {
        id: draft.client.id,
        name: draft.client.name,
        email: draft.client.email,
        billing_address: draft.client.billing_address,
        hourly_rate: fromCents(draft.client.hourly_rate),
        currency: draft.client.currency
      },
      periodStart: toIsoDate(params.periodStart),
      periodEnd: toIsoDate(params.periodEnd),
      lineItems: draft.lineItems.map((item) => ({
        work_entry_id: item.work_entry_id,
        entry_date: item.entry_date,
        description: item.description,
        hours: item.hours,
        rate: fromCents(item.rate_cents),
        amount: fromCents(item.amount_cents)
      })),
      totalHours: draft.totalHours,
      subtotal: fromCents(draft.subtotalCents),
      total: fromCents(draft.totalCents),
      currency: draft.client.currency
    });
  } catch (err) {
    handleError(err, res, next);
  }
});

// Generate invoice from unbilled work entries
router.post('/', async (req, res, next) => {
  try {
    const value = validate(createInvoiceSchema, req.body);
    const db = getDatabase();

    const invoiceId = await runExclusive(() => withTransaction(db, async () => {
      const draft = await buildInvoiceDraft(db, req.userEmail, value);
      if (draft.lineItems.length === 0) {
        throw new HttpError(422, 'No unbilled work entries in the selected period');
      }

      const invoiceNumber = await nextInvoiceNumber(db, req.userEmail);
      const { lastID } = await run(
        db,
        `INSERT INTO invoices (
           user_email, client_id, invoice_number, status, period_start, period_end, due_date,
           client_name, client_email, billing_address, currency,
           subtotal_cents, total_cents, total_hours, notes
         ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.userEmail,
          draft.client.id,
          invoiceNumber,
          toIsoDate(value.periodStart),
          toIsoDate(value.periodEnd),
          toIsoDate(value.dueDate),
          draft.client.name,
          draft.client.email,
          draft.client.billing_address,
          draft.client.currency,
          draft.subtotalCents,
          draft.totalCents,
          draft.totalHours,
          value.notes || null
        ]
      );

      for (const item of draft.lineItems) {
        await run(
          db,
          `INSERT INTO invoice_line_items (
             invoice_id, user_email, work_entry_id, entry_date, description, hours, rate_cents, amount_cents
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            lastID,
            req.userEmail,
            item.work_entry_id,
            item.entry_date,
            item.description,
            item.hours,
            item.rate_cents,
            item.amount_cents
          ]
        );
      }
      return lastID;
    }));

    const invoice = await getOwnedInvoice(db, req.userEmail, invoiceId);
    const lineItems = await getInvoiceLineItems(db, req.userEmail, invoice);
    res.status(201).json({
      message: 'Invoice created successfully',
      invoice: formatInvoice(invoice),
      lineItems: lineItems.map(formatLineItem)
    });
  } catch (err) {
    handleError(err, res, next);
  }
});

// Get invoice with line items
router.get('/:id', async (req, res, next) => {
  try {
    const invoiceId = parseId(req.params.id);
    const db = getDatabase();
    const invoice = await getOwnedInvoice(db, req.userEmail, invoiceId);
    const lineItems = await getInvoiceLineItems(db, req.userEmail, invoice);
    res.json({ invoice: formatInvoice(invoice), lineItems: lineItems.map(formatLineItem) });
  } catch (err) {
    handleError(err, res, next);
  }
});

// Transition invoice status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const invoiceId = parseId(req.params.id);
    const { status } = validate(updateInvoiceStatusSchema, req.body);
    const db = getDatabase();

    await runExclusive(() => withTransaction(db, async () => {
      const invoice = await getOwnedInvoice(db, req.userEmail, invoiceId);
      if (!STATUS_TRANSITIONS[invoice.status].includes(status)) {
        throw new HttpError(409, `Cannot change invoice status from ${invoice.status} to ${status}`);
      }

      if (status === 'void') {
        // Archive the lines for audit, then release the entries so they can be billed again
        await run(
          db,
          `INSERT INTO invoice_line_items_archive (
             invoice_id, user_email, work_entry_id, entry_date, description, hours, rate_cents, amount_cents, created_at
           )
           SELECT invoice_id, user_email, work_entry_id, entry_date, description, hours, rate_cents, amount_cents, created_at
           FROM invoice_line_items WHERE invoice_id = ? AND user_email = ?`,
          [invoiceId, req.userEmail]
        );
        await run(db, 'DELETE FROM invoice_line_items WHERE invoice_id = ? AND user_email = ?', [invoiceId, req.userEmail]);
      }

      const issueDate = status === 'issued' ? toIsoDate(new Date()) : invoice.issue_date;
      await run(
        db,
        `UPDATE invoices SET status = ?, issue_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_email = ?`,
        [status, issueDate, invoiceId, req.userEmail]
      );
    }));

    const invoice = await getOwnedInvoice(db, req.userEmail, invoiceId);
    res.json({ message: 'Invoice status updated successfully', invoice: formatInvoice(invoice) });
  } catch (err) {
    handleError(err, res, next);
  }
});

// Delete a draft invoice (its entries become billable again)
router.delete('/:id', async (req, res, next) => {
  try {
    const invoiceId = parseId(req.params.id);
    const db = getDatabase();

    await runExclusive(() => withTransaction(db, async () => {
      const invoice = await getOwnedInvoice(db, req.userEmail, invoiceId);
      if (invoice.status !== 'draft') {
        throw new HttpError(409, 'Only draft invoices can be deleted');
      }
      await run(db, 'DELETE FROM invoice_line_items WHERE invoice_id = ? AND user_email = ?', [invoiceId, req.userEmail]);
      await run(db, "DELETE FROM invoices WHERE id = ? AND user_email = ? AND status = 'draft'", [invoiceId, req.userEmail]);
    }));

    res.json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    handleError(err, res, next);
  }
});

// Download invoice PDF (rendered only from snapshot data)
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const invoiceId = parseId(req.params.id);
    const db = getDatabase();
    const invoice = await getOwnedInvoice(db, req.userEmail, invoiceId);
    const lineItems = await getInvoiceLineItems(db, req.userEmail, invoice);

    const filename = `${invoice.invoice_number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument();
    doc.pipe(res);

    doc.fontSize(20).text(`Invoice ${invoice.invoice_number}`, { align: 'center' });
    if (invoice.status === 'void') {
      doc.fontSize(14).text('VOID', { align: 'center' });
    }
    doc.moveDown();

    doc.fontSize(12);
    doc.text(`From: ${invoice.user_email}`);
    doc.text(`Status: ${invoice.status}`);
    doc.text(`Period: ${invoice.period_start} to ${invoice.period_end}`);
    if (invoice.issue_date) doc.text(`Issue date: ${invoice.issue_date}`);
    if (invoice.due_date) doc.text(`Due date: ${invoice.due_date}`);
    doc.moveDown();

    doc.text('Bill to:');
    doc.text(invoice.client_name);
    if (invoice.client_email) doc.text(invoice.client_email);
    if (invoice.billing_address) doc.text(invoice.billing_address);
    doc.moveDown();

    const headerY = doc.y;
    doc.text('Date', 50, headerY, { width: 80 });
    doc.text('Description', 130, headerY, { width: 200 });
    doc.text('Hours', 330, headerY, { width: 50 });
    doc.text('Rate', 380, headerY, { width: 80 });
    doc.text('Amount', 460, headerY, { width: 90 });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    lineItems.forEach((item) => {
      if (doc.y > 700) {
        doc.addPage();
      }
      const y = doc.y;
      doc.text(item.entry_date, 50, y, { width: 80 });
      doc.text(item.description || 'No description', 130, y, { width: 200 });
      doc.text(Number(item.hours).toFixed(2), 330, y, { width: 50 });
      doc.text(formatMoney(item.rate_cents, invoice.currency), 380, y, { width: 80 });
      doc.text(formatMoney(item.amount_cents, invoice.currency), 460, y, { width: 90 });
      doc.moveDown();
    });

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.text(`Total hours: ${Number(invoice.total_hours).toFixed(2)}`, 50);
    doc.text(`Subtotal: ${formatMoney(invoice.subtotal_cents, invoice.currency)}`, 50);
    doc.fontSize(14).text(`Total: ${formatMoney(invoice.total_cents, invoice.currency)}`, 50);

    if (invoice.notes) {
      doc.moveDown();
      doc.fontSize(12).text(`Notes: ${invoice.notes}`, 50);
    }

    doc.end();
  } catch (err) {
    handleError(err, res, next);
  }
});

module.exports = router;
