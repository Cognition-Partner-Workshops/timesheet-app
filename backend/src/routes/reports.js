const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const TEMP_DIR = path.join(__dirname, '../../temp');

// PDF layout (points, letter page). Columns: date | hours | description.
const PDF_LAYOUT = {
  MARGIN_LEFT: 50,
  LINE_RIGHT: 550,
  DATE_X: 50,
  DATE_WIDTH: 100,
  HOURS_X: 150,
  HOURS_WIDTH: 80,
  DESCRIPTION_X: 230,
  DESCRIPTION_WIDTH: 300,
  HEADER_LINE_OFFSET: 15,
  PAGE_BREAK_Y: 700,
  ROWS_PER_SEPARATOR: 5,
  TITLE_FONT_SIZE: 20,
  SUMMARY_FONT_SIZE: 14,
  BODY_FONT_SIZE: 12
};

// All routes require authentication
router.use(authenticateUser);

/**
 * Loads a client (scoped to the user) and its work entries, newest first.
 * Sends the appropriate 404/500 response itself on failure and calls
 * `onSuccess(client, workEntries)` otherwise.
 */
function loadClientReport(req, res, columns, onSuccess) {
  const clientId = parseInt(req.params.clientId);

  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }

  const db = getDatabase();

  db.get(
    'SELECT id, name FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, client) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      db.all(
        `SELECT ${columns}
         FROM work_entries
         WHERE client_id = ? AND user_email = ?
         ORDER BY date DESC`,
        [clientId, req.userEmail],
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

/** Sums `hours` across entries; SQLite may return DECIMAL as string. */
function sumHours(workEntries) {
  return workEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
}

/** Builds a filesystem-safe download name like `Acme_Corp_report_2024-01-01T00-00-00-000Z.csv`. */
function buildReportFilename(clientName, extension) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
  return `${safeName}_report_${timestamp}.${extension}`;
}

/**
 * GET /client/:clientId
 * Returns the client, its work entries, total hours and entry count as JSON.
 */
router.get('/client/:clientId', (req, res) => {
  loadClientReport(
    req,
    res,
    'id, hours, description, date, created_at, updated_at',
    (client, workEntries) => {
      res.json({
        client: client,
        workEntries: workEntries,
        totalHours: sumHours(workEntries),
        entryCount: workEntries.length
      });
    }
  );
});

/**
 * GET /export/csv/:clientId
 * Writes the client's work entries to a temp CSV file, streams it as a
 * download, then deletes the temp file.
 */
router.get('/export/csv/:clientId', (req, res) => {
  loadClientReport(
    req,
    res,
    'hours, description, date, created_at',
    (client, workEntries) => {
      const filename = buildReportFilename(client.name, 'csv');
      const tempPath = path.join(TEMP_DIR, filename);

      // Ensure temp directory exists
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
          // Send file and clean up
          res.download(tempPath, filename, (err) => {
            if (err) {
              console.error('Error sending file:', err);
            }
            // Clean up temp file
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
    }
  );
});

/**
 * GET /export/pdf/:clientId
 * Streams a PDF summary (totals plus a date/hours/description table) of the
 * client's work entries directly to the response.
 */
router.get('/export/pdf/:clientId', (req, res) => {
  loadClientReport(
    req,
    res,
    'hours, description, date, created_at',
    (client, workEntries) => {
      const doc = new PDFDocument();
      const filename = buildReportFilename(client.name, 'pdf');
      const L = PDF_LAYOUT;

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Pipe PDF to response
      doc.pipe(res);

      // Add content to PDF
      doc.fontSize(L.TITLE_FONT_SIZE).text(`Time Report for ${client.name}`, { align: 'center' });
      doc.moveDown();

      const totalHours = sumHours(workEntries);
      doc.fontSize(L.SUMMARY_FONT_SIZE).text(`Total Hours: ${totalHours.toFixed(2)}`);
      doc.text(`Total Entries: ${workEntries.length}`);
      doc.text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();

      // Add table header
      doc.fontSize(L.BODY_FONT_SIZE).text('Date', L.DATE_X, doc.y, { width: L.DATE_WIDTH });
      doc.text('Hours', L.HOURS_X, doc.y - L.HEADER_LINE_OFFSET, { width: L.HOURS_WIDTH });
      doc.text('Description', L.DESCRIPTION_X, doc.y - L.HEADER_LINE_OFFSET, { width: L.DESCRIPTION_WIDTH });
      doc.moveDown();

      // Add horizontal line
      doc.moveTo(L.MARGIN_LEFT, doc.y).lineTo(L.LINE_RIGHT, doc.y).stroke();
      doc.moveDown(0.5);

      // Add work entries
      workEntries.forEach((entry, index) => {
        const y = doc.y;

        // Check if we need a new page
        if (y > L.PAGE_BREAK_Y) {
          doc.addPage();
        }

        doc.text(entry.date, L.DATE_X, doc.y, { width: L.DATE_WIDTH });
        doc.text(entry.hours.toString(), L.HOURS_X, y, { width: L.HOURS_WIDTH });
        doc.text(entry.description || 'No description', L.DESCRIPTION_X, y, { width: L.DESCRIPTION_WIDTH });
        doc.moveDown();

        if ((index + 1) % L.ROWS_PER_SEPARATOR === 0) {
          doc.moveTo(L.MARGIN_LEFT, doc.y).lineTo(L.LINE_RIGHT, doc.y).stroke();
          doc.moveDown(0.5);
        }
      });

      // Finalize PDF
      doc.end();
    }
  );
});

module.exports = router;
