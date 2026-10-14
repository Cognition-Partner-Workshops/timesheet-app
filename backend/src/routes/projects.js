const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

const PROJECT_SELECT = `
  SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
         p.created_at, p.updated_at, c.name as client_name
  FROM projects p
  JOIN clients c ON p.client_id = c.id
`;

function handleDbError(res, err, message = 'Internal server error') {
  console.error('Database error:', err);
  return res.status(500).json({ error: message });
}

function parseProjectId(req, res) {
  const projectId = parseInt(req.params.id);

  if (isNaN(projectId)) {
    res.status(400).json({ error: 'Invalid project ID' });
    return null;
  }

  return projectId;
}

function toDateString(value) {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString().split('T')[0] : value;
}

function sendProject(res, db, projectId, status, message) {
  db.get(`${PROJECT_SELECT} WHERE p.id = ?`, [projectId], (err, row) => {
    if (err) {
      return handleDbError(res, err, 'Project saved but failed to retrieve');
    }

    res.status(status).json({ message, project: row });
  });
}

function withOwnedClient(req, res, clientId, next) {
  const db = getDatabase();

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

      next();
    }
  );
}

// Get all projects for authenticated user (with optional client and status filters)
router.get('/', (req, res) => {
  const { clientId, status } = req.query;
  const db = getDatabase();

  let query = `${PROJECT_SELECT} WHERE p.user_email = ?`;
  const params = [req.userEmail];

  if (clientId) {
    const clientIdNum = parseInt(clientId);
    if (isNaN(clientIdNum)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    query += ' AND p.client_id = ?';
    params.push(clientIdNum);
  }

  if (status) {
    query += ' AND p.status = ?';
    params.push(status);
  }

  query += ' ORDER BY p.name';

  db.all(query, params, (err, rows) => {
    if (err) {
      return handleDbError(res, err);
    }

    res.json({ projects: rows });
  });
});

// Get specific project
router.get('/:id', (req, res) => {
  const projectId = parseProjectId(req, res);
  if (projectId === null) {
    return;
  }

  const db = getDatabase();

  db.get(
    `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`,
    [projectId, req.userEmail],
    (err, row) => {
      if (err) {
        return handleDbError(res, err);
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

    withOwnedClient(req, res, clientId, () => {
      const db = getDatabase();

      db.run(
        'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || null, clientId, toDateString(startDate), status || 'active', req.userEmail],
        function(err) {
          if (err) {
            return handleDbError(res, err, 'Failed to create project');
          }

          sendProject(res, db, this.lastID, 201, 'Project created successfully');
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
    const projectId = parseProjectId(req, res);
    if (projectId === null) {
      return;
    }

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const db = getDatabase();

    db.get(
      'SELECT id FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail],
      (err, row) => {
        if (err) {
          return handleDbError(res, err);
        }

        if (!row) {
          return res.status(404).json({ error: 'Project not found' });
        }

        const performUpdate = () => {
          const columns = {
            name: value.name,
            description: value.description === undefined ? undefined : value.description || null,
            client_id: value.clientId,
            start_date: value.startDate === undefined ? undefined : toDateString(value.startDate),
            status: value.status
          };

          const updates = [];
          const values = [];

          Object.entries(columns).forEach(([column, columnValue]) => {
            if (columnValue !== undefined) {
              updates.push(`${column} = ?`);
              values.push(columnValue);
            }
          });

          updates.push('updated_at = CURRENT_TIMESTAMP');
          values.push(projectId, req.userEmail);

          db.run(
            `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`,
            values,
            (err) => {
              if (err) {
                return handleDbError(res, err, 'Failed to update project');
              }

              sendProject(res, db, projectId, 200, 'Project updated successfully');
            }
          );
        };

        if (value.clientId !== undefined) {
          withOwnedClient(req, res, value.clientId, performUpdate);
        } else {
          performUpdate();
        }
      }
    );
  } catch (error) {
    next(error);
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  const projectId = parseProjectId(req, res);
  if (projectId === null) {
    return;
  }

  const db = getDatabase();

  db.get(
    'SELECT id FROM projects WHERE id = ? AND user_email = ?',
    [projectId, req.userEmail],
    (err, row) => {
      if (err) {
        return handleDbError(res, err);
      }

      if (!row) {
        return res.status(404).json({ error: 'Project not found' });
      }

      db.run(
        'DELETE FROM projects WHERE id = ? AND user_email = ?',
        [projectId, req.userEmail],
        (err) => {
          if (err) {
            return handleDbError(res, err, 'Failed to delete project');
          }

          res.json({ message: 'Project deleted successfully' });
        }
      );
    }
  );
});

module.exports = router;
