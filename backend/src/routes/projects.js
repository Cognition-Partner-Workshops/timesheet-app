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

// Normalize a validated date to the YYYY-MM-DD form stored in the DATE column
function toDateString(date) {
  return new Date(date).toISOString().split('T')[0];
}

function handleDbError(res, err, message = 'Internal server error') {
  console.error('Database error:', err);
  res.status(500).json({ error: message });
}

// Look up a project the user owns, then run the callback
function withOwnedProject(req, res, projectId, callback) {
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

      callback(db);
    }
  );
}

// Verify the client referenced by a project belongs to the user
function withOwnedClient(req, res, clientId, callback) {
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

      callback(db);
    }
  );
}

// Return a single project by id, used after create/update
function respondWithProject(res, db, projectId, statusCode, message, retrieveError) {
  db.get(`${PROJECT_SELECT} WHERE p.id = ?`, [projectId], (err, row) => {
    if (err) {
      return handleDbError(res, err, retrieveError);
    }

    res.status(statusCode).json({ message, project: row });
  });
}

function parseProjectId(req, res) {
  const projectId = parseInt(req.params.id);

  if (isNaN(projectId)) {
    res.status(400).json({ error: 'Invalid project ID' });
    return null;
  }

  return projectId;
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

    withOwnedClient(req, res, clientId, (db) => {
      db.run(
        'INSERT INTO projects (name, description, client_id, user_email, start_date, status) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || null, clientId, req.userEmail, toDateString(startDate), status || 'active'],
        function(err) {
          if (err) {
            return handleDbError(res, err, 'Failed to create project');
          }

          respondWithProject(
            res,
            db,
            this.lastID,
            201,
            'Project created successfully',
            'Project created but failed to retrieve'
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
    const projectId = parseProjectId(req, res);
    if (projectId === null) {
      return;
    }

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    withOwnedProject(req, res, projectId, () => {
      if (value.clientId) {
        withOwnedClient(req, res, value.clientId, (db) => performUpdate(db));
      } else {
        performUpdate(getDatabase());
      }
    });

    function performUpdate(db) {
      const updates = [];
      const values = [];

      const columns = {
        name: value.name,
        description: value.description === undefined ? undefined : value.description || null,
        client_id: value.clientId,
        start_date: value.startDate === undefined ? undefined : toDateString(value.startDate),
        status: value.status
      };

      Object.entries(columns).forEach(([column, columnValue]) => {
        if (columnValue !== undefined) {
          updates.push(`${column} = ?`);
          values.push(columnValue);
        }
      });

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(projectId, req.userEmail);

      const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

      db.run(query, values, (err) => {
        if (err) {
          return handleDbError(res, err, 'Failed to update project');
        }

        respondWithProject(
          res,
          db,
          projectId,
          200,
          'Project updated successfully',
          'Project updated but failed to retrieve'
        );
      });
    }
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

  withOwnedProject(req, res, projectId, (db) => {
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
  });
});

module.exports = router;
