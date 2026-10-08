const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema, PROJECT_STATUSES } = require('../validation/schemas');

const router = express.Router();

const PROJECT_SELECT = `
  SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
         p.created_at, p.updated_at, c.name as client_name
  FROM projects p
  JOIN clients c ON p.client_id = c.id
`;

function toDateString(date) {
  return date.toISOString().split('T')[0];
}

const UPDATABLE_FIELDS = [
  { key: 'name', column: 'name', toDb: (v) => v },
  { key: 'description', column: 'description', toDb: (v) => v || null },
  { key: 'clientId', column: 'client_id', toDb: (v) => v },
  { key: 'startDate', column: 'start_date', toDb: toDateString },
  { key: 'status', column: 'status', toDb: (v) => v }
];

// Calls onVerified when clientId is absent or belongs to the user; otherwise responds with an error.
function withOwnedClient(db, req, res, clientId, onVerified) {
  if (clientId === undefined) {
    return onVerified();
  }

  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!row) {
        return res.status(400).json({ error: 'Client not found or does not belong to user' });
      }

      onVerified();
    }
  );
}

// All routes require authentication
router.use(authenticateUser);

// Get all projects for authenticated user (with optional client/status filters)
router.get('/', (req, res) => {
  const { clientId, status } = req.query;
  const db = getDatabase();

  let query = `${PROJECT_SELECT} WHERE p.user_email = ?`;
  const params = [req.userEmail];

  if (clientId) {
    const clientIdNum = Number.parseInt(clientId);
    if (Number.isNaN(clientIdNum)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    query += ' AND p.client_id = ?';
    params.push(clientIdNum);
  }

  if (status) {
    if (!PROJECT_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid project status' });
    }
    query += ' AND p.status = ?';
    params.push(status);
  }

  query += ' ORDER BY p.name';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({ projects: rows });
  });
});

// Get specific project
router.get('/:id', (req, res) => {
  const projectId = Number.parseInt(req.params.id);

  if (Number.isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const db = getDatabase();

  db.get(
    `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`,
    [projectId, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json({ project: row });
    }
  );
});

// Create new project
router.post('/', (req, res, next) => {
  try {
    const { error, value } = projectSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { name, description, clientId, startDate, status } = value;
    const db = getDatabase();

    withOwnedClient(db, req, res, clientId, () => {
      db.run(
        'INSERT INTO projects (name, description, client_id, user_email, start_date, status) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || null, clientId, req.userEmail, toDateString(startDate), status],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to create project' });
          }

          db.get(
            `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`,
            [this.lastID, req.userEmail],
            (err, row) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Project created but failed to retrieve' });
              }

              res.status(201).json({
                message: 'Project created successfully',
                project: row
              });
            }
          );
        }
      );
    });
  } catch (error) {
    next(error);
  }
});

// Update project
router.put('/:id', (req, res, next) => {
  try {
    const projectId = Number.parseInt(req.params.id);

    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const db = getDatabase();

    db.get(
      'SELECT id FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail],
      (err, existing) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (!existing) {
          return res.status(404).json({ error: 'Project not found' });
        }

        withOwnedClient(db, req, res, value.clientId, () => {
          const fields = UPDATABLE_FIELDS.filter(({ key }) => value[key] !== undefined);
          const updates = fields.map(({ column }) => `${column} = ?`);
          const values = fields.map(({ key, toDb }) => toDb(value[key]));

          updates.push('updated_at = CURRENT_TIMESTAMP');
          values.push(projectId, req.userEmail);

          db.run(
            `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`,
            values,
            (err) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to update project' });
              }

              db.get(
                `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`,
                [projectId, req.userEmail],
                (err, row) => {
                  if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Project updated but failed to retrieve' });
                  }

                  res.json({
                    message: 'Project updated successfully',
                    project: row
                  });
                }
              );
            }
          );
        });
      }
    );
  } catch (error) {
    next(error);
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  const projectId = Number.parseInt(req.params.id);

  if (Number.isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const db = getDatabase();

  // Check if project exists and belongs to user
  db.get(
    'SELECT id FROM projects WHERE id = ? AND user_email = ?',
    [projectId, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Project not found' });
      }

      db.run(
        'DELETE FROM projects WHERE id = ? AND user_email = ?',
        [projectId, req.userEmail],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to delete project' });
          }

          res.json({ message: 'Project deleted successfully' });
        }
      );
    }
  );
});

module.exports = router;
