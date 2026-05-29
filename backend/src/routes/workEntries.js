const express = require('express');
const { getDatabase } = require('../database/init');
const { buildUpdateQuery } = require('../database/helpers');
const { authenticateUser } = require('../middleware/auth');
const { workEntrySchema, updateWorkEntrySchema } = require('../validation/schemas');

const router = express.Router();

router.use(authenticateUser);

const WORK_ENTRY_SELECT = `
  SELECT we.id, we.client_id, we.project_id, we.hours, we.description, we.date,
         we.created_at, we.updated_at, c.name as client_name,
         p.name as project_name
  FROM work_entries we
  JOIN clients c ON we.client_id = c.id
  LEFT JOIN projects p ON we.project_id = p.id`;

function getWorkEntryById(db, entryId, callback) {
  db.get(`${WORK_ENTRY_SELECT} WHERE we.id = ?`, [entryId], callback);
}

function verifyClientOwnership(db, clientId, userEmail, callback) {
  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail],
    (err, row) => {
      if (err) return callback(err);
      if (!row) return callback(null, false);
      callback(null, true);
    }
  );
}

function verifyProjectOwnership(db, projectId, userEmail, clientId, callback) {
  db.get(
    'SELECT id FROM projects WHERE id = ? AND user_email = ? AND client_id = ?',
    [projectId, userEmail, clientId],
    (err, row) => {
      if (err) return callback(err);
      if (!row) return callback(null, false);
      callback(null, true);
    }
  );
}

// Get all work entries for authenticated user (with optional client filter)
router.get('/', (req, res) => {
  const { clientId } = req.query;
  const db = getDatabase();

  let query = `${WORK_ENTRY_SELECT} WHERE we.user_email = ?`;
  const params = [req.userEmail];

  if (clientId) {
    const clientIdNum = parseInt(clientId);
    if (isNaN(clientIdNum)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    query += ' AND we.client_id = ?';
    params.push(clientIdNum);
  }

  query += ' ORDER BY we.date DESC, we.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json({ workEntries: rows });
  });
});

// Get specific work entry
router.get('/:id', (req, res) => {
  const workEntryId = parseInt(req.params.id);
  if (isNaN(workEntryId)) {
    return res.status(400).json({ error: 'Invalid work entry ID' });
  }

  const db = getDatabase();
  db.get(
    `${WORK_ENTRY_SELECT} WHERE we.id = ? AND we.user_email = ?`,
    [workEntryId, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
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
    if (error) return next(error);

    const { clientId, projectId, hours, description, date } = value;
    const db = getDatabase();

    verifyClientOwnership(db, clientId, req.userEmail, (err, valid) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!valid) {
        return res.status(400).json({ error: 'Client not found or does not belong to user' });
      }

      const insertEntry = () => {
        db.run(
          'INSERT INTO work_entries (client_id, project_id, user_email, hours, description, date) VALUES (?, ?, ?, ?, ?, ?)',
          [clientId, projectId || null, req.userEmail, hours, description || null, date],
          function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to create work entry' });
            }
            getWorkEntryById(db, this.lastID, (err, row) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Work entry created but failed to retrieve' });
              }
              res.status(201).json({ message: 'Work entry created successfully', workEntry: row });
            });
          }
        );
      };

      if (projectId) {
        verifyProjectOwnership(db, projectId, req.userEmail, clientId, (err, valid) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }
          if (!valid) {
            return res.status(400).json({ error: 'Project not found or does not belong to the selected client' });
          }
          insertEntry();
        });
      } else {
        insertEntry();
      }
    });
  } catch (error) {
    next(error);
  }
});

const WORK_ENTRY_FIELD_MAP = {
  clientId: { column: 'client_id' },
  projectId: { column: 'project_id', nullable: true },
  hours: { column: 'hours' },
  description: { column: 'description', nullable: true },
  date: { column: 'date' }
};

function collectUpdateFields(value, fieldMap) {
  const fields = [];
  for (const [key, config] of Object.entries(fieldMap)) {
    if (value[key] !== undefined) {
      const val = config.nullable ? (value[key] != null ? value[key] : null) : value[key];
      fields.push({ column: config.column, value: val });
    }
  }
  return fields;
}

// Update work entry
router.put('/:id', (req, res, next) => {
  try {
    const workEntryId = parseInt(req.params.id);
    if (isNaN(workEntryId)) {
      return res.status(400).json({ error: 'Invalid work entry ID' });
    }

    const { error, value } = updateWorkEntrySchema.validate(req.body);
    if (error) return next(error);

    const db = getDatabase();

    db.get(
      'SELECT id, client_id FROM work_entries WHERE id = ? AND user_email = ?',
      [workEntryId, req.userEmail],
      (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
        if (!row) {
          return res.status(404).json({ error: 'Work entry not found' });
        }

        const doUpdate = () => {
          const fields = collectUpdateFields(value, WORK_ENTRY_FIELD_MAP);
          const { sql, params } = buildUpdateQuery('work_entries', fields, { id: workEntryId, userEmail: req.userEmail });

          db.run(sql, params, function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to update work entry' });
            }
            getWorkEntryById(db, workEntryId, (err, updatedRow) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Work entry updated but failed to retrieve' });
              }
              res.json({ message: 'Work entry updated successfully', workEntry: updatedRow });
            });
          });
        };

        const validateAndUpdate = () => {
          if (value.projectId) {
            const effectiveClientId = value.clientId || row.client_id;
            verifyProjectOwnership(db, value.projectId, req.userEmail, effectiveClientId, (err, valid) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
              }
              if (!valid) {
                return res.status(400).json({ error: 'Project not found or does not belong to the selected client' });
              }
              doUpdate();
            });
          } else {
            doUpdate();
          }
        };

        if (value.clientId) {
          verifyClientOwnership(db, value.clientId, req.userEmail, (err, valid) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }
            if (!valid) {
              return res.status(400).json({ error: 'Client not found or does not belong to user' });
            }
            validateAndUpdate();
          });
        } else {
          validateAndUpdate();
        }
      }
    );
  } catch (error) {
    next(error);
  }
});

// Delete work entry
router.delete('/:id', (req, res) => {
  const workEntryId = parseInt(req.params.id);
  if (isNaN(workEntryId)) {
    return res.status(400).json({ error: 'Invalid work entry ID' });
  }

  const db = getDatabase();

  db.get(
    'SELECT id FROM work_entries WHERE id = ? AND user_email = ?',
    [workEntryId, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Work entry not found' });
      }

      db.run(
        'DELETE FROM work_entries WHERE id = ? AND user_email = ?',
        [workEntryId, req.userEmail],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to delete work entry' });
          }
          res.json({ message: 'Work entry deleted successfully' });
        }
      );
    }
  );
});

module.exports = router;
