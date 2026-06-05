const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

const PROJECT_SELECT = `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status, p.created_at, p.updated_at, c.name as client_name
FROM projects p
LEFT JOIN clients c ON p.client_id = c.id`;

function fetchProjectById(db, projectId, callback) {
  db.get(`${PROJECT_SELECT} WHERE p.id = ?`, [projectId], callback);
}

function parseProjectId(req, res) {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) {
    res.status(400).json({ error: 'Invalid project ID' });
    return null;
  }
  return projectId;
}

function verifyOwnership(db, projectId, userEmail, callback) {
  db.get(
    'SELECT id FROM projects WHERE id = ? AND user_email = ?',
    [projectId, userEmail],
    callback
  );
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
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
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
    if (error) return next(error);

    const { name, description, client_id, start_date, status } = value;
    const db = getDatabase();

    db.run(
      'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, client_id || null, start_date || null, status, req.userEmail],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to create project' });
        }
        fetchProjectById(db, this.lastID, (err, row) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Project created but failed to retrieve' });
          }
          res.status(201).json({ message: 'Project created successfully', project: row });
        });
      }
    );
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
    if (error) return next(error);

    const db = getDatabase();

    verifyOwnership(db, projectId, req.userEmail, (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const updates = [];
      const values = [];
      const fields = { name: value.name, description: value.description, client_id: value.client_id, start_date: value.start_date, status: value.status };

      for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined) {
          updates.push(`${key} = ?`);
          values.push((key === 'status' || key === 'name') ? val : (val || null));
        }
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(projectId, req.userEmail);

      db.run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`, values, function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to update project' });
        }
        fetchProjectById(db, projectId, (err, row) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Project updated but failed to retrieve' });
          }
          res.json({ message: 'Project updated successfully', project: row });
        });
      });
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

  verifyOwnership(db, projectId, req.userEmail, (err, row) => {
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
  });
});

module.exports = router;
