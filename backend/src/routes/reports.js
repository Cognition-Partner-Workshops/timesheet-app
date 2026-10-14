const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

function getClientWithEntries(clientId, userEmail, fields, callback) {
  const db = getDatabase();
  db.get(
    'SELECT id, name FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail],
    (err, client) => {
      if (err) return callback(err, null, null);
      if (!client) return callback(null, null, null);
      db.all(
        `SELECT ${fields} FROM work_entries WHERE client_id = ? AND user_email = ? ORDER BY date DESC`,
        [clientId, userEmail],
        (err, entries) => {
          if (err) return callback(err, client, null);
          callback(null, client, entries);
        }
      );
    }
  );
}

function parseClientId(req, res) {
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) {
    res.status(400).json({ error: 'Invalid client ID' });
    return null;
  }
  return clientId;
}

function handleDbResult(res, err, client, entries) {
  if (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
    return false;
  }
  if (!client) {
    res.status(404).json({ error: 'Client not found' });
    return false;
  }
  if (entries === null) {
    console.error('Database error: entries null');
    res.status(500).json({ error: 'Internal server error' });
    return false;
  }
  return true;
}

// Get hourly report for specific client
router.get('/client/:clientId', (req, res) => {
  const clientId = parseClientId(req, res);
  if (clientId === null) return;

  getClientWithEntries(
    clientId, req.userEmail,
    'id, hours, description, date, created_at, updated_at',
    (err, client, workEntries) => {
      if (!handleDbResult(res, err, client, workEntries)) return;
      const totalHours = workEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
      res.json({
        client,
        workEntries,
        totalHours,
        entryCount: workEntries.length
      });
    }
  );
});

// Export client report as CSV
router.get('/export/csv/:clientId', (req, res) => {
  const clientId = parseClientId(req, res);
  if (clientId === null) return;

  getClientWithEntries(
    clientId, req.userEmail,
    'hours, description, date, created_at',
    (err, client, workEntries) => {
      if (!handleDbResult(res, err, client, workEntries)) return;

      const headers = ['Date', 'Hours', 'Description', 'Created At'];
      let csvContent = headers.join(',') + '\n';

      workEntries.forEach(entry => {
        const row = [
          entry.date,
          entry.hours,
          `"${(entry.description || '').replace(/"/g, '""')}"`,
          entry.created_at
        ].join(',');
        csvContent += row + '\n';
      });

      const filename = `${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_report_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    }
  );
});

// Export client report as PDF
router.get('/export/pdf/:clientId', (req, res) => {
  const clientId = parseClientId(req, res);
  if (clientId === null) return;

  getClientWithEntries(
    clientId, req.userEmail,
    'hours, description, date, created_at',
    (err, client, workEntries) => {
      if (!handleDbResult(res, err, client, workEntries)) return;

      const doc = new PDFDocument();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_report_${timestamp}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      doc.pipe(res);

      doc.fontSize(20).text(`Time Report for ${client.name}`, { align: 'center' });
      doc.moveDown();

      const totalHours = workEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
      doc.fontSize(14).text(`Total Hours: ${totalHours.toFixed(2)}`);
      doc.text(`Total Entries: ${workEntries.length}`);
      doc.text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();

      doc.fontSize(12).text('Date', 50, doc.y, { width: 100 });
      doc.text('Hours', 150, doc.y - 15, { width: 80 });
      doc.text('Description', 230, doc.y - 15, { width: 300 });
      doc.moveDown();

      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      workEntries.forEach((entry, index) => {
        const y = doc.y;
        if (y > 700) {
          doc.addPage();
        }
        doc.text(entry.date, 50, doc.y, { width: 100 });
        doc.text(entry.hours.toString(), 150, y, { width: 80 });
        doc.text(entry.description || 'No description', 230, y, { width: 300 });
        doc.moveDown();
        if ((index + 1) % 5 === 0) {
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown(0.5);
        }
      });

      doc.end();
    }
  );
});

module.exports = router;
