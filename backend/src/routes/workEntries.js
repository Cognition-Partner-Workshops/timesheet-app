const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { workEntrySchema, updateWorkEntrySchema } = require('../validation/schemas');
const {
  parseIdParam,
  validateIdParam,
  buildUpdateSet,
  handleDbError,
  WORK_ENTRY_SELECT,
} = require('./helpers');

/** Updatable work entry columns and their request-body keys. */
const UPDATE_FIELDS = [
  { column: 'client_id', key: 'clientId' },
  { column: 'hours', key: 'hours' },
  { column: 'description', key: 'description', nullable: true },
  { column: 'date', key: 'date' },
];

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Get all work entries for authenticated user (with optional client filter)
router.get('/', (req, res) => {
  const { clientId } = req.query;
  const db = getDatabase();
  
  let query = `${WORK_ENTRY_SELECT} WHERE we.user_email = ?`;
  
  const params = [req.userEmail];
  
  if (clientId) {
    const clientIdNum = parseIdParam(clientId);
    if (clientIdNum === null) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    query += ' AND we.client_id = ?';
    params.push(clientIdNum);
  }
  
  query += ' ORDER BY we.date DESC, we.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return handleDbError(res, err);
    }
    
    res.json({ workEntries: rows });
  });
});

// Get specific work entry
router.get('/:id', validateIdParam('work entry'), (req, res) => {
  const workEntryId = req.parsedId;
  const db = getDatabase();
  
  db.get(
    `${WORK_ENTRY_SELECT} WHERE we.id = ? AND we.user_email = ?`,
    [workEntryId, req.userEmail],
    (err, row) => {
      if (err) {
        return handleDbError(res, err);
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Work entry not found' });
      }
      
      res.json({ workEntry: row });
    }
  );
});

// Create new work entry
router.post('/', (req, res, next) => {
  try {
    const { error, value } = workEntrySchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { clientId, hours, description, date } = value;
    const db = getDatabase();

    // Verify client exists and belongs to user
    db.get(
      'SELECT id FROM clients WHERE id = ? AND user_email = ?',
      [clientId, req.userEmail],
      (err, row) => {
        if (err) {
          return handleDbError(res, err);
        }

        if (!row) {
          return res.status(400).json({ error: 'Client not found or does not belong to user' });
        }

        // Create work entry
        db.run(
          'INSERT INTO work_entries (client_id, user_email, hours, description, date) VALUES (?, ?, ?, ?, ?)',
          [clientId, req.userEmail, hours, description || null, date],
          function(err) {
            if (err) {
              return handleDbError(res, err, 'Failed to create work entry');
            }

            // Return the created work entry with client name
            db.get(
              `${WORK_ENTRY_SELECT} WHERE we.id = ?`,
              [this.lastID],
              (err, row) => {
                if (err) {
                  return handleDbError(res, err, 'Work entry created but failed to retrieve');
                }

                res.status(201).json({
                  message: 'Work entry created successfully',
                  workEntry: row
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    next(error);
  }
});

// Update work entry
router.put('/:id', validateIdParam('work entry'), (req, res, next) => {
  try {
    const workEntryId = req.parsedId;

    const { error, value } = updateWorkEntrySchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const db = getDatabase();

    // Check if work entry exists and belongs to user
    db.get(
      'SELECT id FROM work_entries WHERE id = ? AND user_email = ?',
      [workEntryId, req.userEmail],
      (err, row) => {
        if (err) {
          return handleDbError(res, err);
        }

        if (!row) {
          return res.status(404).json({ error: 'Work entry not found' });
        }

        // If clientId is being updated, verify it belongs to user
        if (value.clientId) {
          db.get(
            'SELECT id FROM clients WHERE id = ? AND user_email = ?',
            [value.clientId, req.userEmail],
            (err, clientRow) => {
              if (err) {
                return handleDbError(res, err);
              }

              if (!clientRow) {
                return res.status(400).json({ error: 'Client not found or does not belong to user' });
              }

              performUpdate();
            }
          );
        } else {
          performUpdate();
        }

        function performUpdate() {
          const { setClause, values } = buildUpdateSet(UPDATE_FIELDS, value);
          values.push(workEntryId, req.userEmail);

          const query = `UPDATE work_entries SET ${setClause} WHERE id = ? AND user_email = ?`;

          db.run(query, values, function(err) {
            if (err) {
              return handleDbError(res, err, 'Failed to update work entry');
            }

            // Return updated work entry with client name
            db.get(
              `${WORK_ENTRY_SELECT} WHERE we.id = ?`,
              [workEntryId],
              (err, row) => {
                if (err) {
                  return handleDbError(res, err, 'Work entry updated but failed to retrieve');
                }

                res.json({
                  message: 'Work entry updated successfully',
                  workEntry: row
                });
              }
            );
          });
        }
      }
    );
  } catch (error) {
    next(error);
  }
});

// Delete work entry
router.delete('/:id', validateIdParam('work entry'), (req, res) => {
  const workEntryId = req.parsedId;
  const db = getDatabase();
  
  // Check if work entry exists and belongs to user
  db.get(
    'SELECT id FROM work_entries WHERE id = ? AND user_email = ?',
    [workEntryId, req.userEmail],
    (err, row) => {
      if (err) {
        return handleDbError(res, err);
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Work entry not found' });
      }
      
      // Delete work entry
      db.run(
        'DELETE FROM work_entries WHERE id = ? AND user_email = ?',
        [workEntryId, req.userEmail],
        function(err) {
          if (err) {
            return handleDbError(res, err, 'Failed to delete work entry');
          }
          
          res.json({ message: 'Work entry deleted successfully' });
        }
      );
    }
  );
});

module.exports = router;
