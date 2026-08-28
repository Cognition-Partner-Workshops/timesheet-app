const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

const PROJECT_SELECT = `
  SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
         p.created_at, p.updated_at, c.name as client_name
  FROM projects p
  LEFT JOIN clients c ON p.client_id = c.id
`;

const PROJECT_FIELDS = [
  { key: 'name', column: 'name', nullable: false },
  { key: 'description', column: 'description', nullable: true },
  { key: 'clientId', column: 'client_id', nullable: true },
  { key: 'startDate', column: 'start_date', nullable: true },
  { key: 'status', column: 'status', nullable: false },
];

function failInternal(res, err) {
  console.error('Database error:', err);
  return res.status(500).json({ error: 'Internal server error' });
}

// Fetch a single project (with client name), scoped to the user, and hand it to the caller
function respondWithProject(db, projectId, userEmail, res, notFoundStatus, wrap) {
  db.get(`${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`, [projectId, userEmail], (err, row) => {
    if (err) {
      return res.status(500).json({ error: wrap.retrieveError });
    }
    if (!row && notFoundStatus) {
      return res.status(notFoundStatus).json({ error: 'Project not found' });
    }
    res.status(wrap.status).json(wrap.message ? { message: wrap.message, project: row } : { project: row });
  });
}

// Ensure an assigned client belongs to the user before continuing
function withVerifiedClient(db, clientId, userEmail, res, proceed) {
  if (!clientId) {
    return proceed();
  }
  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail],
    (err, row) => {
      if (err) return failInternal(res, err);
      if (!row) return res.status(400).json({ error: 'Client not found or does not belong to user' });
      proceed();
    }
  );
}

// Ensure the project exists and belongs to the user before continuing
function withOwnedProject(db, projectId, userEmail, res, proceed) {
  db.get(
    'SELECT id FROM projects WHERE id = ? AND user_email = ?',
    [projectId, userEmail],
    (err, row) => {
      if (err) return failInternal(res, err);
      if (!row) return res.status(404).json({ error: 'Project not found' });
      proceed();
    }
  );
}

function parseId(req, res) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid project ID' });
    return null;
  }
  return id;
}

// All routes require authentication
router.use(authenticateUser);

// Get all projects for authenticated user
router.get('/', (req, res) => {
  const db = getDatabase();

  db.all(
    `${PROJECT_SELECT} WHERE p.user_email = ? ORDER BY p.name`,
    [req.userEmail],
    (err, rows) => {
      if (err) return failInternal(res, err);
      res.json({ projects: rows });
    }
  );
});

// Get specific project
router.get('/:id', (req, res) => {
  const projectId = parseId(req, res);
  if (projectId === null) return;

  const db = getDatabase();

  db.get(
    `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`,
    [projectId, req.userEmail],
    (err, row) => {
      if (err) return failInternal(res, err);
      if (!row) return res.status(404).json({ error: 'Project not found' });
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

    withVerifiedClient(db, clientId, req.userEmail, res, () => {
      db.run(
        'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || null, clientId || null, startDate || null, status || 'active', req.userEmail],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to create project' });
          }

          respondWithProject(db, this.lastID, req.userEmail, res, null, {
            status: 201,
            message: 'Project created successfully',
            retrieveError: 'Project created but failed to retrieve',
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
    const projectId = parseId(req, res);
    if (projectId === null) return;

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const db = getDatabase();

    const applyUpdate = () => {
      const updates = [];
      const values = [];

      for (const field of PROJECT_FIELDS) {
        if (value[field.key] === undefined) continue;
        updates.push(`${field.column} = ?`);
        values.push(field.nullable ? (value[field.key] || null) : value[field.key]);
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(projectId, req.userEmail);

      const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

      db.run(query, values, function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to update project' });
        }

        respondWithProject(db, projectId, req.userEmail, res, null, {
          status: 200,
          message: 'Project updated successfully',
          retrieveError: 'Project updated but failed to retrieve',
        });
      });
    };

    withOwnedProject(db, projectId, req.userEmail, res, () => {
      withVerifiedClient(db, value.clientId, req.userEmail, res, applyUpdate);
    });
  } catch (error) {
    next(error);
  }
});

// Delete all projects for authenticated user
router.delete('/', (req, res) => {
  const db = getDatabase();

  db.run('DELETE FROM projects WHERE user_email = ?', [req.userEmail], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to delete projects' });
    }

    res.json({
      message: 'All projects deleted successfully',
      deletedCount: this.changes,
    });
  });
});

// Delete project
router.delete('/:id', (req, res) => {
  const projectId = parseId(req, res);
  if (projectId === null) return;

  const db = getDatabase();

  withOwnedProject(db, projectId, req.userEmail, res, () => {
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
  });
});

module.exports = router;
