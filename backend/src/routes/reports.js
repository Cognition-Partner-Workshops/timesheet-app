const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// PDF layout constants (points)
const PDF_PAGE_BREAK_Y = 700;
const PDF_SEPARATOR_INTERVAL = 5;

/**
 * Parses and validates the clientId route parameter. Responds with 400 and
 * returns null when the value is not a valid integer.
 */
function parseClientIdParam(req, res) {
  const clientId = Number.parseInt(req.params.clientId);
  if (Number.isNaN(clientId)) {
    res.status(400).json({ error: 'Invalid client ID' });
    return null;
  }
  return clientId;
}

/**
 * Verifies the client belongs to the user and loads its work entries
 * (newest first). Sends the appropriate error response itself; the callback
 * is only invoked on success with (client, workEntries).
 */
function loadClientWithEntries(db, clientId, userEmail, res, onSuccess) {
  db.get(
    'SELECT id, name FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail],
    (err, client) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      db.all(
        `SELECT id, hours, description, date, created_at, updated_at
         FROM work_entries 
         WHERE client_id = ? AND user_email = ? 
         ORDER BY date DESC`,
        [clientId, userEmail],
        (err, workEntries) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }

          onSuccess(client, workEntries);
        }
      );
    }
  );
}

/** Sums the hours across a set of work entries. */
function sumHours(workEntries) {
  return workEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
}

/** Builds a filesystem-safe export filename like Acme_Co_report_<timestamp>.<ext>. */
function buildExportFilename(clientName, extension) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
  return `${safeName}_report_${timestamp}.${extension}`;
}

// Get hourly report (entries, total hours, entry count) for a specific client
router.get('/client/:clientId', (req, res) => {
  const clientId = parseClientIdParam(req, res);
  if (clientId === null) return;

  const db = getDatabase();

  loadClientWithEntries(db, clientId, req.userEmail, res, (client, workEntries) => {
    res.json({
      client: client,
      workEntries: workEntries,
      totalHours: sumHours(workEntries),
      entryCount: workEntries.length
    });
  });
});

// Export client report as a downloadable CSV file
router.get('/export/csv/:clientId', (req, res) => {
  const clientId = parseClientIdParam(req, res);
  if (clientId === null) return;

  const db = getDatabase();

  loadClientWithEntries(db, clientId, req.userEmail, res, (client, workEntries) => {
    // Write to a temp file because csv-writer only supports file output;
    // the file is removed once the download completes
    const filename = buildExportFilename(client.name, 'csv');
    const tempPath = path.join(__dirname, '../../temp', filename);

    const tempDir = path.dirname(tempPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const csvWriter = createCsvWriter({
      path: tempPath,
      header: [
        { id: 'date', title: 'Date' },
        { id: 'hours', title: 'Hours' },
        { id: 'description', title: 'Description' },
        { id: 'created_at', title: 'Created At' }
      ]
    });

    csvWriter.writeRecords(workEntries)
      .then(() => {
        res.download(tempPath, filename, (err) => {
          if (err) {
            console.error('Error sending file:', err);
          }
          fs.unlink(tempPath, (unlinkErr) => {
            if (unlinkErr) {
              console.error('Error deleting temp file:', unlinkErr);
            }
          });
        });
      })
      .catch((error) => {
        console.error('Error creating CSV:', error);
        res.status(500).json({ error: 'Failed to generate CSV report' });
      });
  });
});

// Export client report as a PDF streamed directly to the response
router.get('/export/pdf/:clientId', (req, res) => {
  const clientId = parseClientIdParam(req, res);
  if (clientId === null) return;

  const db = getDatabase();

  loadClientWithEntries(db, clientId, req.userEmail, res, (client, workEntries) => {
    const doc = new PDFDocument();
    const filename = buildExportFilename(client.name, 'pdf');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    doc.fontSize(20).text(`Time Report for ${client.name}`, { align: 'center' });
    doc.moveDown();

    const totalHours = sumHours(workEntries);
    doc.fontSize(14).text(`Total Hours: ${totalHours.toFixed(2)}`);
    doc.text(`Total Entries: ${workEntries.length}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    // Table header
    doc.fontSize(12).text('Date', 50, doc.y, { width: 100 });
    doc.text('Hours', 150, doc.y - 15, { width: 80 });
    doc.text('Description', 230, doc.y - 15, { width: 300 });
    doc.moveDown();

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    workEntries.forEach((entry, index) => {
      const y = doc.y;

      if (y > PDF_PAGE_BREAK_Y) {
        doc.addPage();
      }

      doc.text(entry.date, 50, doc.y, { width: 100 });
      doc.text(entry.hours.toString(), 150, y, { width: 80 });
      doc.text(entry.description || 'No description', 230, y, { width: 300 });
      doc.moveDown();

      // Separator line between groups of entries for readability
      if ((index + 1) % PDF_SEPARATOR_INTERVAL === 0) {
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);
      }
    });

    doc.end();
  });
});

module.exports = router;
