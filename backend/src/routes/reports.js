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

/**
 * Validates the clientId param, verifies ownership, and fetches associated work entries.
 * Calls `callback(client, workEntries)` on success; sends an error response otherwise.
 *
 * @param {string} selectColumns - columns to select from work_entries
 */
function fetchClientWithEntries(req, res, selectColumns, callback) {
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
        `SELECT ${selectColumns}
         FROM work_entries
         WHERE client_id = ? AND user_email = ?
         ORDER BY date DESC`,
        [clientId, req.userEmail],
        (err, workEntries) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }

          callback(client, workEntries);
        }
      );
    }
  );
}

// Get hourly report for specific client
router.get('/client/:clientId', (req, res) => {
  fetchClientWithEntries(
    req,
    res,
    'id, hours, description, date, created_at, updated_at',
    (client, workEntries) => {
      const totalHours = workEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);

      res.json({
        client: client,
        workEntries: workEntries,
        totalHours: totalHours,
        entryCount: workEntries.length
      });
    }
  );
});

// Export client report as CSV
router.get('/export/csv/:clientId', (req, res) => {
  fetchClientWithEntries(
    req,
    res,
    'hours, description, date, created_at',
    (client, workEntries) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_report_${timestamp}.csv`;
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
    }
  );
});

// Export client report as PDF
router.get('/export/pdf/:clientId', (req, res) => {
  fetchClientWithEntries(
    req,
    res,
    'hours, description, date, created_at',
    (client, workEntries) => {
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
