const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

const PROJECT_SELECT = `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
                               p.created_at, p.updated_at, c.name as client_name
                        FROM projects p
                        JOIN clients c ON p.client_id = c.id`;

// Map incoming payload fields to their database columns
const UPDATABLE_COLUMNS = {
  name: 'name',
  description: 'description',
  clientId: 'client_id',
  startDate: 'start_date',
  status: 'status'
};

// Joi coerces ISO dates to Date objects; store them as YYYY-MM-DD strings
function toDateString(date) {
  return new Date(date).toISOString().split('T')[0];
}

function parseProjectId(req, res) {
  const projectId = parseInt(req.params.id);

  if (isNaN(projectId)) {
    res.status(400).json({ error: 'Invalid project ID' });
    return null;
  }

  return projectId;
}

function handleDbError(res, err, message = 'Internal server error') {
  console.error('Database error:', err);
  res.status(500).json({ error: message });
}

// Fetch a project by id and send it back, or report the given failure message
function sendProject(res, projectId, failureMessage, respond) {
  getDatabase().get(`${PROJECT_SELECT} WHERE p.id = ?`, [projectId], (err, row) => {
    if (err) {
      return handleDbError(res, err, failureMessage);
    }

    respond(row);
  });
}

// Verify the project exists and belongs to the user before running onFound
function withOwnedProject(req, res, projectId, onFound) {
  getDatabase().get(
    'SELECT id FROM projects WHERE id = ? AND user_email = ?',
    [projectId, req.userEmail],
    (err, row) => {
      if (err) {
        return handleDbError(res, err);
      }

      if (!row) {
        return res.status(404).json({ error: 'Project not found' });
      }

      onFound();
    }
  );
}

// Verify the referenced client belongs to the user before running onFound
function withOwnedClient(req, res, clientId, onFound) {
  getDatabase().get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, row) => {
      if (err) {
        return handleDbError(res, err);
      }

      if (!row) {
        return res.status(400).json({ error: 'Client not found or does not belong to user' });
      }

      onFound();
    }
  );
}

// Get all projects for authenticated user, optionally filtered by client
router.get('/', (req, res) => {
  const { clientId } = req.query;
  const params = [req.userEmail];
  let query = `${PROJECT_SELECT} WHERE p.user_email = ?`;

  if (clientId !== undefined) {
    const parsedClientId = parseInt(clientId);

    if (isNaN(parsedClientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    query += ' AND p.client_id = ?';
    params.push(parsedClientId);
  }

  query += ' ORDER BY p.start_date DESC, p.name';

  getDatabase().all(query, params, (err, rows) => {
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

  getDatabase().get(
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
      getDatabase().run(
        'INSERT INTO projects (name, description, client_id, user_email, start_date, status) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || null, clientId, req.userEmail, toDateString(startDate), status || 'active'],
        function(err) {
          if (err) {
            return handleDbError(res, err, 'Failed to create project');
          }

          sendProject(res, this.lastID, 'Project created but failed to retrieve', (row) => {
            res.status(201).json({
              message: 'Project created successfully',
              project: row
            });
          });
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

    const applyUpdate = () => {
      const updates = [];
      const values = [];

      Object.entries(UPDATABLE_COLUMNS).forEach(([field, column]) => {
        if (value[field] !== undefined) {
          updates.push(`${column} = ?`);
          values.push(field === 'startDate' ? toDateString(value[field]) : value[field] || null);
        }
      });

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(projectId, req.userEmail);

      const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

      getDatabase().run(query, values, (err) => {
        if (err) {
          return handleDbError(res, err, 'Failed to update project');
        }

        sendProject(res, projectId, 'Project updated but failed to retrieve', (row) => {
          res.json({
            message: 'Project updated successfully',
            project: row
          });
        });
      });
    };

    withOwnedProject(req, res, projectId, () => {
      if (value.clientId !== undefined) {
        return withOwnedClient(req, res, value.clientId, applyUpdate);
      }

      applyUpdate();
    });
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

  withOwnedProject(req, res, projectId, () => {
    getDatabase().run(
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
