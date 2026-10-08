const { run, get, all } = require('../database/migrations');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const OPEN_STATUSES = ['issued'];

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Integer-only half-up rounding: quantity has at most 2 decimals.
function lineAmountCents(quantity, unitPriceCents) {
  if (unitPriceCents === null || unitPriceCents === undefined) return 0;
  const product = Math.round(Number(quantity) * 100) * unitPriceCents;
  return Math.floor((product + 50) / 100);
}

function taxCents(subtotalCents, taxRateBp) {
  return Math.floor((subtotalCents * taxRateBp + 5000) / 10000);
}

function computeTotals(lines, taxRateBp) {
  const subtotal = lines.reduce((sum, l) => sum + lineAmountCents(l.quantity, l.unitPriceCents), 0);
  const tax = taxCents(subtotal, taxRateBp);
  return { subtotalCents: subtotal, taxCents: tax, totalCents: subtotal + tax };
}

function isOverdue(invoice, today = todayUtc()) {
  return invoice.status === 'issued' && invoice.due_date < today;
}

// node-sqlite3 shares one connection, so BEGIN must not interleave between requests.
let transactionQueue = Promise.resolve();
function withTransaction(db, fn) {
  const result = transactionQueue.then(async () => {
    await run(db, 'BEGIN IMMEDIATE');
    try {
      const value = await fn();
      await run(db, 'COMMIT');
      return value;
    } catch (err) {
      await run(db, 'ROLLBACK').catch(() => {});
      throw err;
    }
  });
  transactionQueue = result.catch(() => {});
  return result;
}

const PROFILE_DEFAULTS = {
  business_name: null,
  address: null,
  tax_id: null,
  invoice_prefix: 'INV',
  next_invoice_seq: 1,
  default_currency: 'USD',
  default_tax_rate_bp: 0,
  default_payment_terms_days: 30,
};

async function getBillingProfile(db, userEmail) {
  const row = await get(db, 'SELECT * FROM billing_profiles WHERE user_email = ?', [userEmail]);
  return row || { user_email: userEmail, ...PROFILE_DEFAULTS };
}

async function upsertBillingProfile(db, userEmail, value) {
  const fields = {
    businessName: 'business_name',
    address: 'address',
    taxId: 'tax_id',
    invoicePrefix: 'invoice_prefix',
    defaultCurrency: 'default_currency',
    defaultTaxRateBp: 'default_tax_rate_bp',
    defaultPaymentTermsDays: 'default_payment_terms_days',
  };
  await run(db, 'INSERT OR IGNORE INTO billing_profiles (user_email) VALUES (?)', [userEmail]);
  const updates = [];
  const params = [];
  for (const [key, column] of Object.entries(fields)) {
    if (value[key] !== undefined) {
      updates.push(`${column} = ?`);
      params.push(value[key] === '' ? null : value[key]);
    }
  }
  if (updates.length) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    await run(db, `UPDATE billing_profiles SET ${updates.join(', ')} WHERE user_email = ?`, [...params, userEmail]);
  }
  return getBillingProfile(db, userEmail);
}

async function getOwnedClient(db, userEmail, clientId) {
  const client = await get(db, 'SELECT * FROM clients WHERE id = ? AND user_email = ?', [clientId, userEmail]);
  if (!client) throw new HttpError(400, 'Client not found or does not belong to user');
  return client;
}

async function getOwnedInvoiceRow(db, userEmail, invoiceId) {
  const invoice = await get(db, 'SELECT * FROM invoices WHERE id = ? AND user_email = ?', [invoiceId, userEmail]);
  if (!invoice) throw new HttpError(404, 'Invoice not found');
  return invoice;
}

async function resolveLines(db, userEmail, client, lines, invoiceId = null) {
  const entryIds = lines.filter((l) => l.workEntryId).map((l) => l.workEntryId);
  if (new Set(entryIds).size !== entryIds.length) {
    throw new HttpError(400, 'A work entry can only appear once on an invoice');
  }

  const entries = new Map();
  if (entryIds.length) {
    const placeholders = entryIds.map(() => '?').join(', ');
    const rows = await all(
      db,
      `SELECT id, client_id, hours, description, date, invoice_id FROM work_entries
       WHERE id IN (${placeholders}) AND user_email = ?`,
      [...entryIds, userEmail]
    );
    rows.forEach((r) => entries.set(r.id, r));
  }

  return lines.map((line, index) => {
    if (line.workEntryId) {
      const entry = entries.get(line.workEntryId);
      if (!entry) throw new HttpError(400, `Work entry ${line.workEntryId} not found`);
      if (entry.client_id !== client.id) {
        throw new HttpError(400, `Work entry ${line.workEntryId} belongs to a different client`);
      }
      if (entry.invoice_id !== null && entry.invoice_id !== invoiceId) {
        throw new HttpError(409, `Work entry ${line.workEntryId} is already on another invoice`);
      }
      return {
        workEntryId: entry.id,
        date: line.date !== undefined ? line.date : entry.date,
        description: line.description || entry.description || 'Work',
        quantity: line.quantity !== undefined ? line.quantity : Number(entry.hours),
        unitPriceCents: line.unitPriceCents !== undefined ? line.unitPriceCents : client.hourly_rate_cents,
        sortOrder: index,
      };
    }
    return {
      workEntryId: null,
      date: line.date || null,
      description: line.description,
      quantity: line.quantity !== undefined ? line.quantity : 1,
      unitPriceCents: line.unitPriceCents !== undefined ? line.unitPriceCents : null,
      sortOrder: index,
    };
  });
}

async function releaseEntries(db, userEmail, invoiceId) {
  await run(db, 'UPDATE work_entries SET invoice_id = NULL WHERE invoice_id = ? AND user_email = ?', [invoiceId, userEmail]);
}

async function replaceLines(db, userEmail, invoice, client, resolved) {
  await releaseEntries(db, userEmail, invoice.id);
  await run(db, 'DELETE FROM invoice_line_items WHERE invoice_id = ?', [invoice.id]);

  for (const line of resolved) {
    await run(
      db,
      `INSERT INTO invoice_line_items
        (invoice_id, work_entry_id, date, description, quantity, unit_price_cents, amount_cents, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoice.id, line.workEntryId, line.date, line.description, line.quantity, line.unitPriceCents,
        lineAmountCents(line.quantity, line.unitPriceCents), line.sortOrder]
    );
  }

  const entryIds = resolved.filter((l) => l.workEntryId).map((l) => l.workEntryId);
  if (entryIds.length) {
    const placeholders = entryIds.map(() => '?').join(', ');
    const { changes } = await run(
      db,
      `UPDATE work_entries SET invoice_id = ?
       WHERE id IN (${placeholders}) AND user_email = ? AND client_id = ? AND invoice_id IS NULL`,
      [invoice.id, ...entryIds, userEmail, client.id]
    );
    if (changes !== entryIds.length) {
      throw new HttpError(409, 'One or more work entries are already on another invoice');
    }
  }

  const totals = computeTotals(resolved, invoice.tax_rate_bp);
  await run(
    db,
    `UPDATE invoices SET subtotal_cents = ?, tax_cents = ?, total_cents = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_email = ?`,
    [totals.subtotalCents, totals.taxCents, totals.totalCents, invoice.id, userEmail]
  );
}

function validateDates({ issue_date: issueDate, due_date: dueDate, period_start: start, period_end: end }) {
  if (dueDate < issueDate) throw new HttpError(400, 'Due date cannot be before the issue date');
  if (start && end && start > end) throw new HttpError(400, 'Billing period start must be on or before its end');
}

async function createInvoice(db, userEmail, value) {
  return withTransaction(db, async () => {
    const client = await getOwnedClient(db, userEmail, value.clientId);
    const profile = await getBillingProfile(db, userEmail);
    const issueDate = value.issueDate || todayUtc();
    const terms = client.payment_terms_days ?? profile.default_payment_terms_days;
    const invoice = {
      client_id: client.id,
      period_start: value.periodStart || null,
      period_end: value.periodEnd || null,
      issue_date: issueDate,
      due_date: value.dueDate || addDays(issueDate, terms),
      currency: value.currency || client.currency || profile.default_currency,
      tax_rate_bp: value.taxRateBp ?? profile.default_tax_rate_bp,
      notes: value.notes || null,
    };
    validateDates(invoice);
    const resolved = await resolveLines(db, userEmail, client, value.lines || []);

    const { lastID } = await run(
      db,
      `INSERT INTO invoices
        (user_email, client_id, status, period_start, period_end, issue_date, due_date, currency, tax_rate_bp, notes)
       VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
      [userEmail, invoice.client_id, invoice.period_start, invoice.period_end, invoice.issue_date,
        invoice.due_date, invoice.currency, invoice.tax_rate_bp, invoice.notes]
    );
    await replaceLines(db, userEmail, { id: lastID, ...invoice }, client, resolved);
    return lastID;
  });
}

async function updateInvoice(db, userEmail, invoiceId, value) {
  return withTransaction(db, async () => {
    const existing = await getOwnedInvoiceRow(db, userEmail, invoiceId);
    if (existing.status !== 'draft') throw new HttpError(409, 'Only draft invoices can be edited');

    const client = await getOwnedClient(db, userEmail, value.clientId || existing.client_id);
    const merged = {
      ...existing,
      client_id: client.id,
      period_start: value.periodStart !== undefined ? value.periodStart : existing.period_start,
      period_end: value.periodEnd !== undefined ? value.periodEnd : existing.period_end,
      issue_date: value.issueDate || existing.issue_date,
      due_date: value.dueDate || existing.due_date,
      currency: value.currency || existing.currency,
      tax_rate_bp: value.taxRateBp ?? existing.tax_rate_bp,
      notes: value.notes !== undefined ? (value.notes || null) : existing.notes,
    };
    validateDates(merged);

    let lines = value.lines;
    if (lines === undefined) {
      const current = await all(db, 'SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order, id', [invoiceId]);
      lines = current.map((l) => ({
        workEntryId: l.work_entry_id || undefined,
        date: l.date,
        description: l.description,
        quantity: l.quantity,
        unitPriceCents: l.unit_price_cents,
      }));
    }
    const resolved = await resolveLines(db, userEmail, client, lines, invoiceId);

    await run(
      db,
      `UPDATE invoices SET client_id = ?, period_start = ?, period_end = ?, issue_date = ?, due_date = ?,
         currency = ?, tax_rate_bp = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_email = ?`,
      [merged.client_id, merged.period_start, merged.period_end, merged.issue_date, merged.due_date,
        merged.currency, merged.tax_rate_bp, merged.notes, invoiceId, userEmail]
    );
    await replaceLines(db, userEmail, merged, client, resolved);
  });
}

async function deleteInvoice(db, userEmail, invoiceId) {
  return withTransaction(db, async () => {
    const invoice = await getOwnedInvoiceRow(db, userEmail, invoiceId);
    if (invoice.status !== 'draft') {
      throw new HttpError(409, 'Only draft invoices can be deleted; void issued invoices instead');
    }
    await releaseEntries(db, userEmail, invoiceId);
    await run(db, 'DELETE FROM invoices WHERE id = ? AND user_email = ?', [invoiceId, userEmail]);
  });
}

function formatInvoiceNumber(prefix, seq) {
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

async function issueInvoice(db, userEmail, invoiceId) {
  return withTransaction(db, async () => {
    const invoice = await getOwnedInvoiceRow(db, userEmail, invoiceId);
    if (invoice.status !== 'draft') throw new HttpError(409, 'Only draft invoices can be issued');

    const lines = await all(db, 'SELECT * FROM invoice_line_items WHERE invoice_id = ?', [invoiceId]);
    if (!lines.length) throw new HttpError(422, 'Add at least one line item before issuing');
    if (lines.some((l) => l.unit_price_cents === null)) {
      throw new HttpError(422, 'Every line item needs a rate before issuing');
    }

    const client = await get(db, 'SELECT * FROM clients WHERE id = ? AND user_email = ?', [invoice.client_id, userEmail]);
    await run(db, 'INSERT OR IGNORE INTO billing_profiles (user_email) VALUES (?)', [userEmail]);
    const profile = await getBillingProfile(db, userEmail);

    let seq = profile.next_invoice_seq;
    let number = formatInvoiceNumber(profile.invoice_prefix, seq);
    // Skip numbers already used, e.g. after the prefix was changed back.
    while (await get(db, 'SELECT id FROM invoices WHERE user_email = ? AND invoice_number = ?', [userEmail, number])) {
      seq += 1;
      number = formatInvoiceNumber(profile.invoice_prefix, seq);
    }
    await run(db, 'UPDATE billing_profiles SET next_invoice_seq = ? WHERE user_email = ?', [seq + 1, userEmail]);

    const sender = {
      name: profile.business_name || userEmail,
      address: profile.address,
      taxId: profile.tax_id,
      email: userEmail,
    };
    const billTo = {
      name: client.name,
      address: client.billing_address,
      email: client.billing_email || client.email,
    };
    const totals = computeTotals(
      lines.map((l) => ({ quantity: l.quantity, unitPriceCents: l.unit_price_cents })),
      invoice.tax_rate_bp
    );

    await run(
      db,
      `UPDATE invoices SET status = 'issued', invoice_number = ?, sender_snapshot = ?, client_snapshot = ?,
         subtotal_cents = ?, tax_cents = ?, total_cents = ?, issued_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_email = ? AND status = 'draft'`,
      [number, JSON.stringify(sender), JSON.stringify(billTo), totals.subtotalCents, totals.taxCents,
        totals.totalCents, invoiceId, userEmail]
    );
  });
}

async function transition(db, userEmail, invoiceId, { from, message, set, params = [], release = false }) {
  return withTransaction(db, async () => {
    const invoice = await getOwnedInvoiceRow(db, userEmail, invoiceId);
    if (!from.includes(invoice.status)) throw new HttpError(409, message(invoice.status));
    await run(
      db,
      `UPDATE invoices SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?`,
      [...params, invoiceId, userEmail]
    );
    if (release) await releaseEntries(db, userEmail, invoiceId);
  });
}

function markPaid(db, userEmail, invoiceId, paidDate) {
  return transition(db, userEmail, invoiceId, {
    from: ['issued'],
    message: (status) => `Cannot mark a ${status} invoice as paid`,
    set: "status = 'paid', paid_at = ?",
    params: [paidDate || todayUtc()],
  });
}

function markUnpaid(db, userEmail, invoiceId) {
  return transition(db, userEmail, invoiceId, {
    from: ['paid'],
    message: (status) => `Cannot mark a ${status} invoice as unpaid`,
    set: "status = 'issued', paid_at = NULL",
  });
}

function voidInvoice(db, userEmail, invoiceId, reason) {
  return transition(db, userEmail, invoiceId, {
    from: ['issued', 'paid'],
    message: (status) => (status === 'draft' ? 'Delete draft invoices instead of voiding them' : 'Invoice is already void'),
    set: "status = 'void', void_reason = ?, voided_at = CURRENT_TIMESTAMP",
    params: [reason],
    release: true,
  });
}

function parseSnapshot(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function presentInvoice(row, today = todayUtc()) {
  return {
    ...row,
    sender_snapshot: parseSnapshot(row.sender_snapshot),
    client_snapshot: parseSnapshot(row.client_snapshot),
    is_overdue: isOverdue(row, today),
  };
}

async function getInvoice(db, userEmail, invoiceId) {
  const row = await get(
    db,
    `SELECT i.*, c.name AS client_name FROM invoices i JOIN clients c ON c.id = i.client_id
     WHERE i.id = ? AND i.user_email = ?`,
    [invoiceId, userEmail]
  );
  if (!row) throw new HttpError(404, 'Invoice not found');
  const lines = await all(db, 'SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order, id', [invoiceId]);
  return { ...presentInvoice(row), lines };
}

async function listInvoices(db, userEmail, filters) {
  const today = todayUtc();
  const where = ['i.user_email = ?'];
  const params = [userEmail];
  if (filters.status === 'overdue') {
    where.push("i.status = 'issued' AND i.due_date < ?");
    params.push(today);
  } else if (filters.status) {
    where.push('i.status = ?');
    params.push(filters.status);
  }
  if (filters.clientId) {
    where.push('i.client_id = ?');
    params.push(filters.clientId);
  }
  if (filters.from) {
    where.push('i.issue_date >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    where.push('i.issue_date <= ?');
    params.push(filters.to);
  }
  const whereSql = where.join(' AND ');
  const { total } = await get(db, `SELECT COUNT(*) AS total FROM invoices i WHERE ${whereSql}`, params);
  const rows = await all(
    db,
    `SELECT i.*, c.name AS client_name FROM invoices i JOIN clients c ON c.id = i.client_id
     WHERE ${whereSql}
     ORDER BY i.issue_date DESC, i.id DESC LIMIT ? OFFSET ?`,
    [...params, filters.pageSize, (filters.page - 1) * filters.pageSize]
  );
  const summary = await all(
    db,
    `SELECT currency,
       SUM(CASE WHEN status = 'issued' THEN total_cents ELSE 0 END) AS outstanding_cents,
       SUM(CASE WHEN status = 'issued' AND due_date < ? THEN total_cents ELSE 0 END) AS overdue_cents,
       SUM(CASE WHEN status = 'paid' THEN total_cents ELSE 0 END) AS paid_cents,
       SUM(CASE WHEN status = 'draft' THEN total_cents ELSE 0 END) AS draft_cents
     FROM invoices WHERE user_email = ? GROUP BY currency ORDER BY currency`,
    [today, userEmail]
  );
  return {
    invoices: rows.map((r) => presentInvoice(r, today)),
    pagination: { page: filters.page, pageSize: filters.pageSize, total },
    summary,
  };
}

async function previewUnbilled(db, userEmail, { clientId, from, to }) {
  const client = await getOwnedClient(db, userEmail, clientId);
  const profile = await getBillingProfile(db, userEmail);
  const where = ['user_email = ?', 'client_id = ?', 'invoice_id IS NULL'];
  const params = [userEmail, clientId];
  if (from) {
    where.push('date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('date <= ?');
    params.push(to);
  }
  const entries = await all(
    db,
    `SELECT id, hours, description, date FROM work_entries WHERE ${where.join(' AND ')} ORDER BY date, id`,
    params
  );
  const issueDate = todayUtc();
  return {
    client,
    entries,
    defaults: {
      issueDate,
      dueDate: addDays(issueDate, client.payment_terms_days ?? profile.default_payment_terms_days),
      currency: client.currency || profile.default_currency,
      taxRateBp: profile.default_tax_rate_bp,
      hourlyRateCents: client.hourly_rate_cents,
    },
  };
}

module.exports = {
  HttpError,
  OPEN_STATUSES,
  todayUtc,
  addDays,
  lineAmountCents,
  taxCents,
  computeTotals,
  isOverdue,
  withTransaction,
  getBillingProfile,
  upsertBillingProfile,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  issueInvoice,
  markPaid,
  markUnpaid,
  voidInvoice,
  getInvoice,
  listInvoices,
  previewUnbilled,
  formatInvoiceNumber,
};
