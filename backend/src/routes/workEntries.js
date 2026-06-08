const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { workEntrySchema, updateWorkEntrySchema } = require('../validation/schemas');
const { parseId, sendDbError, buildUpdateClause } = require('../utils/routeHelpers');
const { WORK_ENTRY_SELECT } = require('../database/queries');

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
    const clientIdNum = parseId(clientId);
    if (clientIdNum === null) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    query += ' AND we.client_id = ?';
    params.push(clientIdNum);
  }
  
  query += ' ORDER BY we.date DESC, we.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return sendDbError(res, err);
    }
    
    res.json({ workEntries: rows });
  });
});

// Get specific work entry
router.get('/:id', (req, res) => {
  const workEntryId = parseId(req.params.id);
  
  if (workEntryId === null) {
    return res.status(400).json({ error: 'Invalid work entry ID' });
  }
  
  const db = getDatabase();
  
  db.get(
    `${WORK_ENTRY_SELECT} WHERE we.id = ? AND we.user_email = ?`,
    [workEntryId, req.userEmail],
    (err, row) => {
      if (err) {
        return sendDbError(res, err);
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
          return sendDbError(res, err);
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
              return sendDbError(res, err, 'Failed to create work entry');
            }

            // Return the created work entry with client name
            db.get(
              `${WORK_ENTRY_SELECT} WHERE we.id = ?`,
              [this.lastID],
              (err, row) => {
                if (err) {
                  return sendDbError(res, err, 'Work entry created but failed to retrieve');
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
router.put('/:id', (req, res, next) => {
  try {
    const workEntryId = parseId(req.params.id);
    
    if (workEntryId === null) {
      return res.status(400).json({ error: 'Invalid work entry ID' });
    }

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
          return sendDbError(res, err);
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
                return sendDbError(res, err);
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
          // Build update query dynamically
          const { setClause, params } = buildUpdateClause([
            { column: 'client_id', value: value.clientId, include: value.clientId !== undefined },
            { column: 'hours', value: value.hours, include: value.hours !== undefined },
            { column: 'description', value: value.description || null, include: value.description !== undefined },
            { column: 'date', value: value.date, include: value.date !== undefined }
          ]);
          params.push(workEntryId, req.userEmail);

          const query = `UPDATE work_entries SET ${setClause} WHERE id = ? AND user_email = ?`;

          db.run(query, params, function(err) {
            if (err) {
              return sendDbError(res, err, 'Failed to update work entry');
            }

            // Return updated work entry with client name
            db.get(
              `${WORK_ENTRY_SELECT} WHERE we.id = ?`,
              [workEntryId],
              (err, row) => {
                if (err) {
                  return sendDbError(res, err, 'Work entry updated but failed to retrieve');
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
router.delete('/:id', (req, res) => {
  const workEntryId = parseId(req.params.id);
  
  if (workEntryId === null) {
    return res.status(400).json({ error: 'Invalid work entry ID' });
  }
  
  const db = getDatabase();
  
  // Check if work entry exists and belongs to user
  db.get(
    'SELECT id FROM work_entries WHERE id = ? AND user_email = ?',
    [workEntryId, req.userEmail],
    (err, row) => {
      if (err) {
        return sendDbError(res, err);
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
            return sendDbError(res, err, 'Failed to delete work entry');
          }
          
          res.json({ message: 'Work entry deleted successfully' });
        }
      );
    }
  );
});

module.exports = router;
