const PDFDocument = require('pdfkit');

const MARGIN = 50;
const COLUMNS = [
  { key: 'date', label: 'Date', x: 50, width: 70 },
  { key: 'description', label: 'Description', x: 125, width: 225 },
  { key: 'quantity', label: 'Qty/Hours', x: 355, width: 60, align: 'right' },
  { key: 'rate', label: 'Rate', x: 420, width: 60, align: 'right' },
  { key: 'amount', label: 'Amount', x: 485, width: 60, align: 'right' },
];

function formatMoney(cents, currency) {
  if (cents === null || cents === undefined) return '-';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function sanitizeFilename(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'invoice';
}

function invoiceFilename(invoice) {
  const label = invoice.invoice_number || `draft-${invoice.id}`;
  return `${sanitizeFilename(`invoice-${label}-${invoice.client_name}`)}.pdf`;
}

function partyLines(party) {
  return [party.name, party.address, party.email, party.taxId && `Tax ID: ${party.taxId}`].filter(Boolean);
}

function drawWatermark(doc, text) {
  doc.save();
  doc.fontSize(90).fillColor('#e0e0e0').opacity(0.5);
  doc.rotate(-35, { origin: [300, 400] }).text(text, 60, 360, { width: 500, align: 'center' });
  doc.restore();
  doc.fillColor('black').opacity(1);
}

function drawTableHeader(doc) {
  doc.fontSize(10).font('Helvetica-Bold');
  const y = doc.y;
  COLUMNS.forEach((c) => doc.text(c.label, c.x, y, { width: c.width, align: c.align || 'left' }));
  doc.moveTo(MARGIN, y + 14).lineTo(545, y + 14).stroke();
  doc.font('Helvetica');
  doc.y = y + 20;
}

function streamInvoicePdf(invoice, userEmail, res) {
  const doc = new PDFDocument({ margin: MARGIN, bufferPages: true });
  const watermark = { draft: 'DRAFT', void: 'VOID' }[invoice.status];
  const sender = invoice.sender_snapshot || { name: userEmail, email: userEmail };
  const billTo = invoice.client_snapshot || { name: invoice.client_name };

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoiceFilename(invoice)}"`);
  doc.pipe(res);

  doc.fontSize(24).text('INVOICE', MARGIN, MARGIN, { align: 'right' });
  doc.fontSize(12).text(invoice.invoice_number || 'Draft (number assigned when issued)', { align: 'right' });
  doc.moveDown();

  const topY = doc.y;
  doc.fontSize(10).font('Helvetica-Bold').text('From', MARGIN, topY);
  doc.font('Helvetica').text(partyLines(sender).join('\n'), MARGIN, doc.y, { width: 240 });
  const leftBottom = doc.y;
  doc.font('Helvetica-Bold').text('Bill to', 310, topY);
  doc.font('Helvetica').text(partyLines(billTo).join('\n'), 310, doc.y, { width: 235 });
  doc.y = Math.max(leftBottom, doc.y) + 15;

  const meta = [
    ['Issue date', invoice.issue_date],
    ['Due date', invoice.due_date],
    invoice.period_start || invoice.period_end
      ? ['Billing period', `${invoice.period_start || '...'} to ${invoice.period_end || '...'}`]
      : null,
    ['Status', invoice.status.toUpperCase() + (invoice.is_overdue ? ' (OVERDUE)' : '')],
  ].filter(Boolean);
  meta.forEach(([label, value]) => {
    const y = doc.y;
    doc.font('Helvetica-Bold').text(`${label}:`, MARGIN, y, { width: 100 });
    doc.font('Helvetica').text(value, 150, y);
  });
  doc.moveDown();

  drawTableHeader(doc);
  invoice.lines.forEach((line) => {
    const cells = {
      date: line.date || '',
      description: line.description,
      quantity: String(Number(line.quantity)),
      rate: formatMoney(line.unit_price_cents, invoice.currency),
      amount: formatMoney(line.amount_cents, invoice.currency),
    };
    const rowHeight = Math.max(14, doc.heightOfString(cells.description, { width: COLUMNS[1].width })) + 6;
    if (doc.y + rowHeight > doc.page.height - MARGIN - 30) {
      doc.addPage();
      drawTableHeader(doc);
    }
    const y = doc.y;
    COLUMNS.forEach((c) => doc.text(cells[c.key], c.x, y, { width: c.width, align: c.align || 'left' }));
    doc.y = y + rowHeight;
  });

  if (doc.y > doc.page.height - MARGIN - 120) doc.addPage();
  doc.moveTo(355, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);
  const totals = [
    ['Subtotal', invoice.subtotal_cents],
    [`Tax (${(invoice.tax_rate_bp / 100).toFixed(2)}%)`, invoice.tax_cents],
    ['Total', invoice.total_cents],
  ];
  totals.forEach(([label, cents], i) => {
    const y = doc.y;
    doc.font(i === totals.length - 1 ? 'Helvetica-Bold' : 'Helvetica');
    doc.text(label, 355, y, { width: 100 });
    doc.text(formatMoney(cents, invoice.currency), 455, y, { width: 90, align: 'right' });
  });
  doc.font('Helvetica');

  if (invoice.notes) {
    doc.moveDown(2).font('Helvetica-Bold').text('Notes', MARGIN).font('Helvetica').text(invoice.notes, { width: 495 });
  }
  if (invoice.status === 'void' && invoice.void_reason) {
    doc.moveDown().font('Helvetica-Bold').text(`Void reason: ${invoice.void_reason}`, MARGIN);
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Writing below the bottom margin makes PDFKit add a page, so drop it while drawing the footer.
    const { bottom } = doc.page.margins;
    doc.page.margins.bottom = 0;
    if (watermark) drawWatermark(doc, watermark);
    doc.fontSize(8).fillColor('gray').text(
      `${invoice.invoice_number || 'Draft'}  |  Page ${i + 1} of ${range.count}`,
      MARGIN, doc.page.height - MARGIN + 10, { width: 495, align: 'center', lineBreak: false }
    );
    doc.fillColor('black');
    doc.page.margins.bottom = bottom;
  }

  doc.end();
}

module.exports = { streamInvoicePdf, invoiceFilename, sanitizeFilename, formatMoney };
