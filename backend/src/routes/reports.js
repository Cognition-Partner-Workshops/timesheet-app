const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const router = express.Router();

function entryAmount(entry, hourlyRate) {
  return entry.billable ? (Number.parseFloat(entry.hours) || 0) * hourlyRate : 0;
}

function roundMoney(amount) {
  return Math.round(amount * 100) / 100;
}

function fetchClientReportData(clientId, userEmail, callback) {
  const db = getDatabase();

  db.get(
    'SELECT id, name, hourly_rate AS hourlyRate FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail],
    (err, client) => {
      if (err || !client) {
        return callback(err, client);
      }

      const hourlyRate = Number.parseFloat(client.hourlyRate) || 0;

      db.all(
        `SELECT id, hours, description, date, billable, created_at, updated_at
         FROM work_entries 
         WHERE client_id = ? AND user_email = ? 
         ORDER BY date DESC`,
        [clientId, userEmail],
        (err, workEntries) => {
          if (err) {
            return callback(err);
          }

          callback(null, { client, hourlyRate, workEntries });
        }
      );
    }
  );
}

function handleClientReport(req, res, onData) {
  const clientId = Number.parseInt(req.params.clientId, 10);

  if (Number.isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }

  fetchClientReportData(clientId, req.userEmail, (err, data) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Client not found' });
    }

    onData(data);
  });
}

// All routes require authentication
router.use(authenticateUser);

// Get hourly report for specific client
router.get('/client/:clientId', (req, res) => {
  handleClientReport(req, res, ({ client, hourlyRate, workEntries }) => {
    const workEntriesWithAmounts = workEntries.map(entry => ({
      ...entry,
      amount: roundMoney(entryAmount(entry, hourlyRate))
    }));

    const totalHours = workEntries.reduce((sum, entry) => sum + Number.parseFloat(entry.hours), 0);
    const totalAmount = roundMoney(
      workEntriesWithAmounts.reduce((sum, entry) => sum + entry.amount, 0)
    );

    res.json({
      client,
      workEntries: workEntriesWithAmounts,
      totalHours,
      totalAmount,
      entryCount: workEntries.length
    });
  });
});

// Export client report as CSV
router.get('/export/csv/:clientId', (req, res) => {
  handleClientReport(req, res, ({ client, hourlyRate, workEntries }) => {
    // Create temporary CSV file
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
        { id: 'billable', title: 'Billable' },
        { id: 'amount', title: 'Amount' },
        { id: 'description', title: 'Description' },
        { id: 'created_at', title: 'Created At' }
      ]
    });

    const records = workEntries.map(entry => ({
      ...entry,
      billable: entry.billable ? 'Yes' : 'No',
      amount: roundMoney(entryAmount(entry, hourlyRate)).toFixed(2)
    }));

    csvWriter.writeRecords(records)
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
  });
});

// Export client report as PDF
router.get('/export/pdf/:clientId', (req, res) => {
  handleClientReport(req, res, ({ client, hourlyRate, workEntries }) => {
    // Create PDF
    const doc = new PDFDocument();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_report_${timestamp}.pdf`;

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(20).text(`Time Report for ${client.name}`, { align: 'center' });
    doc.moveDown();

    const totalHours = workEntries.reduce((sum, entry) => sum + Number.parseFloat(entry.hours), 0);
    const totalAmount = roundMoney(
      workEntries.reduce((sum, entry) => sum + entryAmount(entry, hourlyRate), 0)
    );
    doc.fontSize(14).text(`Total Hours: ${totalHours.toFixed(2)}`);
    doc.text(`Total Amount: ${totalAmount.toFixed(2)}`);
    doc.text(`Total Entries: ${workEntries.length}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    // Add table header
    doc.fontSize(12).text('Date', 50, doc.y, { width: 90 });
    doc.text('Hours', 140, doc.y - 15, { width: 60 });
    doc.text('Amount', 200, doc.y - 15, { width: 80 });
    doc.text('Description', 285, doc.y - 15, { width: 265 });
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

      doc.text(entry.date, 50, doc.y, { width: 90 });
      doc.text(entry.hours.toString(), 140, y, { width: 60 });
      doc.text(roundMoney(entryAmount(entry, hourlyRate)).toFixed(2), 200, y, { width: 80 });
      doc.text(entry.description || 'No description', 285, y, { width: 265 });
      doc.moveDown();

      // Add separator line every 5 entries
      if ((index + 1) % 5 === 0) {
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);
      }
    });

    // Finalize PDF
    doc.end();
  });
});

module.exports = router;
