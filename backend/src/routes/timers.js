const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Get current running timer
router.get('/active', (req, res) => {
  const db = getDatabase();

  db.get(
    `SELECT t.id, t.client_id, t.description, t.started_at, t.created_at, c.name as client_name
     FROM active_timers t
     JOIN clients c ON t.client_id = c.id
     WHERE t.user_email = ?`,
    [req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'No active timer' });
      }

      res.json({ timer: row });
    }
  );
});

// Start a new timer
router.post('/start', (req, res) => {
  const { clientId, description } = req.body;

  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }

  const db = getDatabase();

  // Verify client belongs to user
  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, client) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!client) {
        return res.status(400).json({ error: 'Client not found or does not belong to user' });
      }

      // Check if user already has a running timer
      db.get(
        'SELECT id FROM active_timers WHERE user_email = ?',
        [req.userEmail],
        (err, existing) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }

          if (existing) {
            return res.status(409).json({ error: 'A timer is already running. Stop it first.' });
          }

          const startedAt = new Date().toISOString();

          db.run(
            'INSERT INTO active_timers (user_email, client_id, description, started_at) VALUES (?, ?, ?, ?)',
            [req.userEmail, clientId, description || null, startedAt],
            function(err) {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to start timer' });
              }

              db.get(
                `SELECT t.id, t.client_id, t.description, t.started_at, t.created_at, c.name as client_name
                 FROM active_timers t
                 JOIN clients c ON t.client_id = c.id
                 WHERE t.id = ?`,
                [this.lastID],
                (err, row) => {
                  if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Timer started but failed to retrieve' });
                  }

                  res.status(201).json({ message: 'Timer started', timer: row });
                }
              );
            }
          );
        }
      );
    }
  );
});

// Stop timer and create work entry
router.post('/stop', (req, res) => {
  const db = getDatabase();

  db.get(
    `SELECT t.id, t.client_id, t.description, t.started_at, c.name as client_name
     FROM active_timers t
     JOIN clients c ON t.client_id = c.id
     WHERE t.user_email = ?`,
    [req.userEmail],
    (err, timer) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!timer) {
        return res.status(404).json({ error: 'No active timer to stop' });
      }

      const startedAt = new Date(timer.started_at);
      const now = new Date();
      const elapsedMs = now.getTime() - startedAt.getTime();
      const hours = Math.round((elapsedMs / 3600000) * 100) / 100; // Round to 2 decimals
      const date = now.toISOString().split('T')[0];

      // Create work entry and delete timer in a transaction
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        db.run(
          'INSERT INTO work_entries (client_id, user_email, hours, description, date) VALUES (?, ?, ?, ?, ?)',
          [timer.client_id, req.userEmail, hours > 0 ? hours : 0.01, timer.description, date],
          function(insertErr) {
            if (insertErr) {
              db.run('ROLLBACK');
              console.error('Database error:', insertErr);
              return res.status(500).json({ error: 'Failed to create work entry' });
            }

            const workEntryId = this.lastID;

            db.run(
              'DELETE FROM active_timers WHERE user_email = ?',
              [req.userEmail],
              (deleteErr) => {
                if (deleteErr) {
                  db.run('ROLLBACK');
                  console.error('Database error:', deleteErr);
                  return res.status(500).json({ error: 'Failed to stop timer' });
                }

                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    console.error('Database error:', commitErr);
                    return res.status(500).json({ error: 'Internal server error' });
                  }

                  db.get(
                    `SELECT we.id, we.client_id, we.hours, we.description, we.date,
                            we.created_at, we.updated_at, c.name as client_name
                     FROM work_entries we
                     JOIN clients c ON we.client_id = c.id
                     WHERE we.id = ?`,
                    [workEntryId],
                    (err, workEntry) => {
                      if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: 'Timer stopped but failed to retrieve work entry' });
                      }

                      res.json({
                        message: 'Timer stopped and work entry created',
                        workEntry
                      });
                    }
                  );
                });
              }
            );
          }
        );
      });
    }
  );
});

// Discard running timer without saving
router.delete('/discard', (req, res) => {
  const db = getDatabase();

  db.get(
    'SELECT id FROM active_timers WHERE user_email = ?',
    [req.userEmail],
    (err, timer) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!timer) {
        return res.status(404).json({ error: 'No active timer to discard' });
      }

      db.run(
        'DELETE FROM active_timers WHERE user_email = ?',
        [req.userEmail],
        (err) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to discard timer' });
          }

          res.json({ message: 'Timer discarded' });
        }
      );
    }
  );
});

module.exports = router;
