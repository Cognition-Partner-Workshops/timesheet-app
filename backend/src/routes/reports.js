const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Validates optional startDate/endDate query params; sends a 400 response and
// returns null when invalid, otherwise returns the parsed range.
function parseDateRange(req, res) {
  const { startDate, endDate } = req.query;

  if (startDate && !DATE_REGEX.test(startDate)) {
    res.status(400).json({ error: 'Invalid startDate format. Expected YYYY-MM-DD' });
    return null;
  }

  if (endDate && !DATE_REGEX.test(endDate)) {
    res.status(400).json({ error: 'Invalid endDate format. Expected YYYY-MM-DD' });
    return null;
  }

  if (startDate && endDate && startDate > endDate) {
    res.status(400).json({ error: 'startDate must not be after endDate' });
    return null;
  }

  return { startDate, endDate };
}

function buildDateFilter(startDate, endDate) {
  let clause = '';
  const params = [];

  if (startDate) {
    clause += ' AND date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    clause += ' AND date <= ?';
    params.push(endDate);
  }

  return { clause, params };
}

// Validates params, verifies the client belongs to the user, fetches the
// client's work entries (optionally date-filtered), then calls
// onData(client, workEntries). Error responses are handled here.
function loadClientReport(req, res, columns, onData) {
  const clientId = parseInt(req.params.clientId);

  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }

  const dateRange = parseDateRange(req, res);
  if (!dateRange) {
    return;
  }
  const dateFilter = buildDateFilter(dateRange.startDate, dateRange.endDate);

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
         WHERE client_id = ? AND user_email = ?${dateFilter.clause} 
         ORDER BY date DESC`,
        [clientId, req.userEmail, ...dateFilter.params],
        (err, workEntries) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }

          onData(client, workEntries);
        }
      );
    }
  );
}

function buildExportFilename(client, extension) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_report_${timestamp}.${extension}`;
}

// All routes require authentication
router.use(authenticateUser);

// Get hourly report for specific client
router.get('/client/:clientId', (req, res) => {
  loadClientReport(
    req,
    res,
    'id, hours, description, date, created_at, updated_at',
    (client, workEntries) => {
      // Calculate total hours
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
  loadClientReport(
    req,
    res,
    'hours, description, date, created_at',
    (client, workEntries) => {
      // Create temporary CSV file
      const filename = buildExportFilename(client, 'csv');
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
  loadClientReport(
    req,
    res,
    'hours, description, date, created_at',
    (client, workEntries) => {
      // Create PDF
      const doc = new PDFDocument();
      const filename = buildExportFilename(client, 'pdf');

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Pipe PDF to response
      doc.pipe(res);

      // Add content to PDF
      doc.fontSize(20).text(`Time Report for ${client.name}`, { align: 'center' });
      doc.moveDown();

      const totalHours = workEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
      doc.fontSize(14).text(`Total Hours: ${totalHours.toFixed(2)}`);
      doc.text(`Total Entries: ${workEntries.length}`);
      doc.text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();

      // Add table header
      doc.fontSize(12).text('Date', 50, doc.y, { width: 100 });
      doc.text('Hours', 150, doc.y - 15, { width: 80 });
      doc.text('Description', 230, doc.y - 15, { width: 300 });
      doc.moveDown();

      // Add horizontal line
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      // Add work entries
      workEntries.forEach((entry, index) => {
        const y = doc.y;

        // Check if we need a new page
        if (y > 700) {
          doc.addPage();
        }

        doc.text(entry.date, 50, doc.y, { width: 100 });
        doc.text(entry.hours.toString(), 150, y, { width: 80 });
        doc.text(entry.description || 'No description', 230, y, { width: 300 });
        doc.moveDown();

        // Add separator line every 5 entries
        if ((index + 1) % 5 === 0) {
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown(0.5);
        }
      });

      // Finalize PDF
      doc.end();
    }
  );
});

module.exports = router;
