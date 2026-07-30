const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { workEntrySchema, updateWorkEntrySchema } = require('../validation/schemas');
const {
  internalError,
  findOwnedRow,
  requireReference,
  sendRow,
  buildUpdates,
  parseIdParam
} = require('../utils/dbHelpers');

const router = express.Router();

const WORK_ENTRY_SELECT = `
  SELECT we.id, we.client_id, we.project_id, we.hours, we.description, we.date,
         we.created_at, we.updated_at, c.name as client_name, p.name as project_name
  FROM work_entries we
  JOIN clients c ON we.client_id = c.id
  LEFT JOIN projects p ON we.project_id = p.id
`;

// All routes require authentication
router.use(authenticateUser);

// Verify the project exists, belongs to the user and belongs to the given client
function verifyProjectOwnership(db, projectId, clientId, userEmail, res, onSuccess) {
  requireReference(
    db,
    'SELECT id FROM projects WHERE id = ? AND user_email = ? AND client_id = ?',
    [projectId, userEmail, clientId],
    res,
    'Project not found or does not belong to the client',
    onSuccess
  );
}

// Verify the client exists and belongs to the user
function verifyClientOwnership(db, clientId, userEmail, res, onSuccess) {
  requireReference(
    db,
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail],
    res,
    'Client not found or does not belong to user',
    onSuccess
  );
}

function parseWorkEntryId(req, res) {
  return parseIdParam(req, res, 'id', 'Invalid work entry ID');
}

function sendWorkEntry(db, workEntryId, res, action, status) {
  sendRow(db, `${WORK_ENTRY_SELECT} WHERE we.id = ?`, [workEntryId], res, {
    key: 'workEntry',
    entity: 'Work entry',
    action,
    status
  });
}

// Get all work entries for authenticated user (with optional client and project filters)
router.get('/', (req, res) => {
  const { clientId, projectId } = req.query;
  const db = getDatabase();
  
  let query = `${WORK_ENTRY_SELECT}
    WHERE we.user_email = ?
  `;
  
  const params = [req.userEmail];
  
  if (clientId) {
    const clientIdNum = parseInt(clientId);
    if (isNaN(clientIdNum)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    query += ' AND we.client_id = ?';
    params.push(clientIdNum);
  }
  
  if (projectId) {
    const projectIdNum = parseInt(projectId);
    if (isNaN(projectIdNum)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }
    query += ' AND we.project_id = ?';
    params.push(projectIdNum);
  }
  
  query += ' ORDER BY we.date DESC, we.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return internalError(res, err);
    }
    
    res.json({ workEntries: rows });
  });
});

// Get specific work entry
router.get('/:id', (req, res) => {
  const workEntryId = parseWorkEntryId(req, res);
  if (workEntryId === null) {
    return;
  }

  findOwnedRow(
    getDatabase(),
    `${WORK_ENTRY_SELECT} WHERE we.id = ? AND we.user_email = ?`,
    [workEntryId, req.userEmail],
    res,
    'Work entry not found',
    (row) => res.json({ workEntry: row })
  );
});

// Create new work entry
router.post('/', (req, res, next) => {
  try {
    const { error, value } = workEntrySchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { clientId, projectId, hours, description, date } = value;
    const db = getDatabase();

    const createEntry = () => {
      db.run(
        'INSERT INTO work_entries (client_id, project_id, user_email, hours, description, date) VALUES (?, ?, ?, ?, ?, ?)',
        [clientId, projectId || null, req.userEmail, hours, description || null, date],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to create work entry' });
          }

          sendWorkEntry(db, this.lastID, res, 'created', 201);
        }
      );
    };

    verifyClientOwnership(db, clientId, req.userEmail, res, () => {
      if (projectId) {
        verifyProjectOwnership(db, projectId, clientId, req.userEmail, res, createEntry);
      } else {
        createEntry();
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update work entry
router.put('/:id', (req, res, next) => {
  try {
    const workEntryId = parseWorkEntryId(req, res);
    if (workEntryId === null) {
      return;
    }

    const { error, value } = updateWorkEntrySchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const db = getDatabase();

    // Check if work entry exists and belongs to user
    findOwnedRow(
      db,
      'SELECT id, client_id FROM work_entries WHERE id = ? AND user_email = ?',
      [workEntryId, req.userEmail],
      res,
      'Work entry not found',
      (row) => {
        const targetClientId = value.clientId || row.client_id;

        const performUpdate = () => {
          const { updates, values } = buildUpdates(value, {
            clientId: ['client_id', false],
            projectId: ['project_id', true],
            hours: ['hours', false],
            description: ['description', true],
            date: ['date', false]
          });

          values.push(workEntryId, req.userEmail);

          const query = `UPDATE work_entries SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

          db.run(query, values, function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to update work entry' });
            }

            sendWorkEntry(db, workEntryId, res, 'updated', 200);
          });
        };

        const verifyProjectThenUpdate = () => {
          if (value.projectId) {
            verifyProjectOwnership(db, value.projectId, targetClientId, req.userEmail, res, performUpdate);
          } else {
            performUpdate();
          }
        };

        // If clientId is being updated, verify it belongs to user
        if (value.clientId) {
          verifyClientOwnership(db, value.clientId, req.userEmail, res, verifyProjectThenUpdate);
        } else {
          verifyProjectThenUpdate();
        }
      }
    );
  } catch (error) {
    next(error);
  }
});

// Delete work entry
router.delete('/:id', (req, res) => {
  const workEntryId = parseWorkEntryId(req, res);
  if (workEntryId === null) {
    return;
  }

  const db = getDatabase();

  // Check if work entry exists and belongs to user
  findOwnedRow(
    db,
    'SELECT id FROM work_entries WHERE id = ? AND user_email = ?',
    [workEntryId, req.userEmail],
    res,
    'Work entry not found',
    () => {
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
