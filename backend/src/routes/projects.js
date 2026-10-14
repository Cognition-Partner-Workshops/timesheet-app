const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

const PROJECT_COLUMNS = `p.id, p.name, p.description, p.client_id, p.start_date, p.status,
         p.created_at, p.updated_at, c.name as client_name`;

const SELECT_PROJECT = `SELECT ${PROJECT_COLUMNS}
   FROM projects p
   LEFT JOIN clients c ON p.client_id = c.id
   WHERE p.id = ?`;

// All routes require authentication
router.use(authenticateUser);

function handleDbError(res, err, message) {
  console.error('Database error:', err);
  res.status(500).json({ error: message });
}

function parseProjectId(req, res) {
  const projectId = parseInt(req.params.id);

  if (isNaN(projectId)) {
    res.status(400).json({ error: 'Invalid project ID' });
    return null;
  }

  return projectId;
}

function sendProject(res, projectId, status, message) {
  const db = getDatabase();

  db.get(SELECT_PROJECT, [projectId], (err, row) => {
    if (err) {
      return handleDbError(res, err, 'Project saved but failed to retrieve');
    }

    res.status(status).json({ message, project: row });
  });
}

// Verify the client belongs to the authenticated user, when one is provided
function withValidClient(req, res, clientId, callback) {
  if (clientId === undefined || clientId === null) {
    return callback();
  }

  const db = getDatabase();

  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, row) => {
      if (err) {
        return handleDbError(res, err, 'Internal server error');
      }

      if (!row) {
        return res.status(404).json({ error: 'Client not found' });
      }

      callback();
    }
  );
}

// Get all projects for authenticated user (with optional status filter)
router.get('/', (req, res) => {
  const { status } = req.query;
  const db = getDatabase();

  let query = `SELECT ${PROJECT_COLUMNS}
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.user_email = ?`;
  const params = [req.userEmail];

  if (status) {
    query += ' AND p.status = ?';
    params.push(status);
  }

  query += ' ORDER BY p.name';

  db.all(query, params, (err, rows) => {
    if (err) {
      return handleDbError(res, err, 'Internal server error');
    }

    res.json({ projects: rows });
  });
});

// Get specific project
router.get('/:id', (req, res) => {
  const projectId = parseProjectId(req, res);
  if (projectId === null) return;

  const db = getDatabase();

  db.get(
    `${SELECT_PROJECT} AND p.user_email = ?`,
    [projectId, req.userEmail],
    (err, row) => {
      if (err) {
        return handleDbError(res, err, 'Internal server error');
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

    withValidClient(req, res, clientId, () => {
      const db = getDatabase();

      db.run(
        'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || null, clientId || null, startDate || null, status || 'active', req.userEmail],
        function(err) {
          if (err) {
            return handleDbError(res, err, 'Failed to create project');
          }

          sendProject(res, this.lastID, 201, 'Project created successfully');
        }
      );
    });
  } catch (error) {
    next(error);
  }
});

const UPDATABLE_FIELDS = [
  { key: 'name', column: 'name' },
  { key: 'description', column: 'description' },
  { key: 'clientId', column: 'client_id' },
  { key: 'startDate', column: 'start_date' },
  { key: 'status', column: 'status' }
];

// Update project
router.put('/:id', (req, res, next) => {
  try {
    const projectId = parseProjectId(req, res);
    if (projectId === null) return;

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
          return handleDbError(res, err, 'Internal server error');
        }

        if (!row) {
          return res.status(404).json({ error: 'Project not found' });
        }

        withValidClient(req, res, value.clientId, () => {
          const updates = [];
          const values = [];

          UPDATABLE_FIELDS.forEach(({ key, column }) => {
            if (value[key] !== undefined) {
              updates.push(`${column} = ?`);
              values.push(value[key] === '' ? null : value[key]);
            }
          });

          updates.push('updated_at = CURRENT_TIMESTAMP');
          values.push(projectId, req.userEmail);

          const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

          db.run(query, values, function(err) {
            if (err) {
              return handleDbError(res, err, 'Failed to update project');
            }

            sendProject(res, projectId, 200, 'Project updated successfully');
          });
        });
      }
    );
  } catch (error) {
    next(error);
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  const projectId = parseProjectId(req, res);
  if (projectId === null) return;

  const db = getDatabase();

  db.get(
    'SELECT id FROM projects WHERE id = ? AND user_email = ?',
    [projectId, req.userEmail],
    (err, row) => {
      if (err) {
        return handleDbError(res, err, 'Internal server error');
      }

      if (!row) {
        return res.status(404).json({ error: 'Project not found' });
      }

      db.run(
        'DELETE FROM projects WHERE id = ? AND user_email = ?',
        [projectId, req.userEmail],
        function(err) {
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
