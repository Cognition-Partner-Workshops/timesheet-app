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
  LEFT JOIN clients c ON p.client_id = c.id
`;

function formatDate(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return value;
}

function handleDbError(res, err, message = 'Internal server error') {
  console.error('Database error:', err);
  res.status(500).json({ error: message });
}

// Fetch a project by id and respond with it (used after create/update)
function respondWithProject(db, res, projectId, { status = 200, message, errorMessage }) {
  db.get(`${PROJECT_SELECT} WHERE p.id = ?`, [projectId], (err, row) => {
    if (err) {
      return handleDbError(res, err, errorMessage);
    }
    res.status(status).json({ message, project: row });
  });
}

// Verify a client exists and belongs to the user, then invoke onSuccess
function verifyClientOwnership(db, res, clientId, userEmail, onSuccess) {
  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail],
    (err, row) => {
      if (err) {
        return handleDbError(res, err);
      }
      if (!row) {
        return res.status(400).json({ error: 'Client not found or does not belong to user' });
      }
      onSuccess();
    }
  );
}

// Look up a project owned by the user, then invoke onFound
function requireOwnedProject(db, res, projectId, userEmail, onFound) {
  db.get(
    'SELECT id FROM projects WHERE id = ? AND user_email = ?',
    [projectId, userEmail],
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

// Get all projects for authenticated user
router.get('/', (req, res) => {
  const db = getDatabase();

  db.all(
    `${PROJECT_SELECT} WHERE p.user_email = ? ORDER BY p.name`,
    [req.userEmail],
    (err, rows) => {
      if (err) {
        return handleDbError(res, err);
      }
      res.json({ projects: rows });
    }
  );
});

// Get specific project
router.get('/:id', (req, res) => {
  const projectId = parseInt(req.params.id);

  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
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
    const db = getDatabase();

    const insertProject = () => {
      db.run(
        'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || null, clientId || null, formatDate(startDate), status || 'active', req.userEmail],
        function(err) {
          if (err) {
            return handleDbError(res, err, 'Failed to create project');
          }
          respondWithProject(db, res, this.lastID, {
            status: 201,
            message: 'Project created successfully',
            errorMessage: 'Project created but failed to retrieve'
          });
        }
      );
    };

    if (clientId) {
      verifyClientOwnership(db, res, clientId, req.userEmail, insertProject);
    } else {
      insertProject();
    }
  } catch (error) {
    next(error);
  }
});

// Update project
router.put('/:id', (req, res, next) => {
  try {
    const projectId = parseInt(req.params.id);

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const db = getDatabase();

    requireOwnedProject(db, res, projectId, req.userEmail, () => {
      const performUpdate = () => {
        // Build update query dynamically
        const updates = [];
        const values = [];
        const columns = {
          name: value.name,
          description: value.description !== undefined ? (value.description || null) : undefined,
          client_id: value.clientId !== undefined ? (value.clientId || null) : undefined,
          start_date: value.startDate !== undefined ? formatDate(value.startDate) : undefined,
          status: value.status
        };

        for (const [column, columnValue] of Object.entries(columns)) {
          if (columnValue !== undefined) {
            updates.push(`${column} = ?`);
            values.push(columnValue);
          }
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(projectId, req.userEmail);

        const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

        db.run(query, values, function(err) {
          if (err) {
            return handleDbError(res, err, 'Failed to update project');
          }
          respondWithProject(db, res, projectId, {
            message: 'Project updated successfully',
            errorMessage: 'Project updated but failed to retrieve'
          });
        });
      };

      if (value.clientId) {
        verifyClientOwnership(db, res, value.clientId, req.userEmail, performUpdate);
      } else {
        performUpdate();
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  const projectId = parseInt(req.params.id);

  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const db = getDatabase();

  requireOwnedProject(db, res, projectId, req.userEmail, () => {
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
  });
});

module.exports = router;
