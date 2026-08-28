const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

const PROJECT_SELECT = `
  SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
         p.created_at, p.updated_at, c.name AS client_name
  FROM projects p
  JOIN clients c ON c.id = p.client_id
`;

function handleDbError(res, err, message = 'Internal server error') {
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

function fetchProject(db, projectId, userEmail, res, onFound, errorMessage) {
  db.get(
    `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`,
    [projectId, userEmail],
    (err, row) => {
      if (err) {
        return handleDbError(res, err, errorMessage);
      }
      if (!row) {
        return res.status(404).json({ error: 'Project not found' });
      }
      onFound(row);
    }
  );
}

function verifyClientOwnership(db, clientId, userEmail, res, onVerified) {
  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail],
    (err, row) => {
      if (err) {
        return handleDbError(res, err);
      }
      if (!row) {
        return res.status(400).json({ error: 'Client not found' });
      }
      onVerified();
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
  const projectId = parseProjectId(req, res);
  if (projectId === null) return;

  const db = getDatabase();
  fetchProject(db, projectId, req.userEmail, res, (row) => {
    res.json({ project: row });
  });
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

    verifyClientOwnership(db, clientId, req.userEmail, res, () => {
      db.run(
        'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || null, clientId, startDate, status || 'active', req.userEmail],
        function(err) {
          if (err) {
            return handleDbError(res, err, 'Failed to create project');
          }

          fetchProject(db, this.lastID, req.userEmail, res, (row) => {
            res.status(201).json({
              message: 'Project created successfully',
              project: row
            });
          }, 'Project created but failed to retrieve');
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
    if (projectId === null) return;

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const db = getDatabase();

    fetchProject(db, projectId, req.userEmail, res, () => {
      const applyUpdate = () => {
        const columnMap = {
          name: 'name',
          description: 'description',
          clientId: 'client_id',
          startDate: 'start_date',
          status: 'status'
        };

        const updates = [];
        const values = [];

        for (const [field, column] of Object.entries(columnMap)) {
          if (value[field] !== undefined) {
            updates.push(`${column} = ?`);
            values.push(field === 'description' ? (value[field] || null) : value[field]);
          }
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(projectId, req.userEmail);

        const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

        db.run(query, values, function(err) {
          if (err) {
            return handleDbError(res, err, 'Failed to update project');
          }

          fetchProject(db, projectId, req.userEmail, res, (row) => {
            res.json({
              message: 'Project updated successfully',
              project: row
            });
          }, 'Project updated but failed to retrieve');
        });
      };

      if (value.clientId !== undefined) {
        verifyClientOwnership(db, value.clientId, req.userEmail, res, applyUpdate);
      } else {
        applyUpdate();
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  const projectId = parseProjectId(req, res);
  if (projectId === null) return;

  const db = getDatabase();

  fetchProject(db, projectId, req.userEmail, res, () => {
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
