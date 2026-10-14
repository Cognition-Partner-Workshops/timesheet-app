const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// PDF layout constants (points)
const PDF_PAGE_BREAK_Y = 700;
const PDF_LINE_START_X = 50;
const PDF_LINE_END_X = 550;
const PDF_SEPARATOR_INTERVAL = 5;

// All routes require authentication
router.use(authenticateUser);

/**
 * Sums the hours across a list of work entries.
 * @param {Array<{hours: number|string}>} workEntries
 * @returns {number} total hours
 */
function sumHours(workEntries) {
  return workEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
}

/**
 * Builds a sanitized, timestamped export filename like
 * `Acme_Corp_report_2024-01-01T00-00-00-000Z.csv`.
 * @param {string} clientName
 * @param {string} extension file extension without the dot (e.g. 'csv')
 * @returns {string}
 */
function buildExportFilename(clientName, extension) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
  return `${safeName}_report_${timestamp}.${extension}`;
}

/**
 * Verifies the client belongs to the authenticated user, then loads its work
 * entries. Sends the appropriate error response itself on failure; on success
 * calls `onSuccess(client, workEntries)`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} entryColumns columns to select from work_entries
 * @param {(client: object, workEntries: Array<object>) => void} onSuccess
 */
function loadClientReportData(req, res, entryColumns, onSuccess) {
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
        `SELECT ${entryColumns}
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

// Get hourly report for specific client
router.get('/client/:clientId', (req, res) => {
  loadClientReportData(
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

// Export client report as CSV
router.get('/export/csv/:clientId', (req, res) => {
  loadClientReportData(
    req,
    res,
    'hours, description, date, created_at',
    (client, workEntries) => {
      // Create temporary CSV file
      const filename = buildExportFilename(client.name, 'csv');
      const tempPath = path.join(__dirname, '../../temp', filename);

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

// Export client report as PDF
router.get('/export/pdf/:clientId', (req, res) => {
  loadClientReportData(
    req,
    res,
    'hours, description, date, created_at',
    (client, workEntries) => {
      // Create PDF
      const doc = new PDFDocument();
      const filename = buildExportFilename(client.name, 'pdf');

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Pipe PDF to response
      doc.pipe(res);

      // Add content to PDF
      doc.fontSize(20).text(`Time Report for ${client.name}`, { align: 'center' });
      doc.moveDown();

      const totalHours = sumHours(workEntries);
      doc.fontSize(14).text(`Total Hours: ${totalHours.toFixed(2)}`);
      doc.text(`Total Entries: ${workEntries.length}`);
      doc.text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();

      // Add table header
      doc.fontSize(12).text('Date', PDF_LINE_START_X, doc.y, { width: 100 });
      doc.text('Hours', 150, doc.y - 15, { width: 80 });
      doc.text('Description', 230, doc.y - 15, { width: 300 });
      doc.moveDown();

      // Add horizontal line
      doc.moveTo(PDF_LINE_START_X, doc.y).lineTo(PDF_LINE_END_X, doc.y).stroke();
      doc.moveDown(0.5);

      // Add work entries
      workEntries.forEach((entry, index) => {
        const y = doc.y;

        // Check if we need a new page
        if (y > PDF_PAGE_BREAK_Y) {
          doc.addPage();
        }

        doc.text(entry.date, PDF_LINE_START_X, doc.y, { width: 100 });
        doc.text(entry.hours.toString(), 150, y, { width: 80 });
        doc.text(entry.description || 'No description', 230, y, { width: 300 });
        doc.moveDown();

        // Add separator line every few entries for readability
        if ((index + 1) % PDF_SEPARATOR_INTERVAL === 0) {
          doc.moveTo(PDF_LINE_START_X, doc.y).lineTo(PDF_LINE_END_X, doc.y).stroke();
          doc.moveDown(0.5);
        }
      });

      // Finalize PDF
      doc.end();
    }
  );
});

module.exports = router;
