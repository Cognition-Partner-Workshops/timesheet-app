const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const Joi = require('joi');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

const weekStartSchema = Joi.object({
  weekStart: Joi.date().iso().required()
});

const submitTimesheetSchema = Joi.object({
  weekStart: Joi.date().iso().required(),
  weekEnd: Joi.date().iso().required(),
  totalHours: Joi.number().min(0).precision(2).required()
});

// GET /api/timesheets/weekly?weekStart=YYYY-MM-DD
router.get('/weekly', (req, res, next) => {
  try {
    const { error, value } = weekStartSchema.validate({ weekStart: req.query.weekStart });
    if (error) {
      return next(error);
    }

    const weekStart = new Date(value.weekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const startStr = weekStart.toISOString().split('T')[0];
    const endStr = weekEnd.toISOString().split('T')[0];

    const db = getDatabase();

    db.all(
      `SELECT we.client_id, c.name as client_name, we.hours, we.date
       FROM work_entries we
       JOIN clients c ON we.client_id = c.id
       WHERE we.user_email = ? AND we.date >= ? AND we.date <= ?
       ORDER BY c.name, we.date`,
      [req.userEmail, startStr, endStr],
      (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        // Group by client and day
        const clientMap = {};
        for (const row of rows) {
          if (!clientMap[row.client_id]) {
            clientMap[row.client_id] = {
              clientId: row.client_id,
              clientName: row.client_name,
              days: {}
            };
          }
          const dayKey = row.date;
          clientMap[row.client_id].days[dayKey] =
            (clientMap[row.client_id].days[dayKey] || 0) + row.hours;
        }

        const clients = Object.values(clientMap);

        // Check submission status
        db.get(
          `SELECT id, status, submitted_at, total_hours
           FROM timesheet_submissions
           WHERE user_email = ? AND week_start = ?`,
          [req.userEmail, startStr],
          (err, submission) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }

            res.json({
              weekStart: startStr,
              weekEnd: endStr,
              clients,
              submission: submission || null
            });
          }
        );
      }
    );
  } catch (error) {
    next(error);
  }
});

// POST /api/timesheets/submit
router.post('/submit', (req, res, next) => {
  try {
    const { error, value } = submitTimesheetSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { weekStart, weekEnd, totalHours } = value;
    const startStr = new Date(weekStart).toISOString().split('T')[0];
    const endStr = new Date(weekEnd).toISOString().split('T')[0];

    const db = getDatabase();

    // Check if already submitted
    db.get(
      `SELECT id FROM timesheet_submissions WHERE user_email = ? AND week_start = ?`,
      [req.userEmail, startStr],
      (err, existing) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (existing) {
          return res.status(409).json({ error: 'Timesheet already submitted for this week' });
        }

        db.run(
          `INSERT INTO timesheet_submissions (user_email, week_start, week_end, total_hours, status)
           VALUES (?, ?, ?, ?, 'submitted')`,
          [req.userEmail, startStr, endStr, totalHours],
          function (err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to submit timesheet' });
            }

            res.status(201).json({
              message: 'Timesheet submitted successfully',
              submission: {
                id: this.lastID,
                weekStart: startStr,
                weekEnd: endStr,
                totalHours,
                status: 'submitted',
                submittedAt: new Date().toISOString()
              }
            });
          }
        );
      }
    );
  } catch (error) {
    next(error);
  }
});

module.exports = router;
