const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

const PROJECT_COLUMNS = 'id, client_id, name, description, created_at, updated_at';

// All routes require authentication
router.use(authenticateUser);

function parseProjectId(req, res) {
  const projectId = parseInt(req.params.id);

  if (isNaN(projectId)) {
    res.status(400).json({ error: 'Invalid project ID' });
    return null;
  }

  return projectId;
}

function verifyClientOwnership(db, clientId, userEmail, res, onSuccess) {
  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!row) {
        return res.status(400).json({ error: 'Client not found or does not belong to user' });
      }

      onSuccess();
    }
  );
}

function sendProject(db, projectId, res, message, status) {
  db.get(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ?`,
    [projectId],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: `Project ${message} but failed to retrieve` });
      }

      res.status(status).json({
        message: `Project ${message} successfully`,
        project: row
      });
    }
  );
}

// Get all projects for authenticated user (with optional client filter)
router.get('/', (req, res) => {
  const { clientId } = req.query;
  const db = getDatabase();

  let query = `SELECT ${PROJECT_COLUMNS} FROM projects WHERE user_email = ?`;
  const params = [req.userEmail];

  if (clientId) {
    const clientIdNum = parseInt(clientId);
    if (isNaN(clientIdNum)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    query += ' AND client_id = ?';
    params.push(clientIdNum);
  }

  query += ' ORDER BY name';

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
  const projectId = parseProjectId(req, res);
  if (projectId === null) {
    return;
  }

  const db = getDatabase();

  db.get(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ? AND user_email = ?`,
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

    const { clientId, name, description } = value;
    const db = getDatabase();

    verifyClientOwnership(db, clientId, req.userEmail, res, () => {
      db.run(
        'INSERT INTO projects (client_id, name, description, user_email) VALUES (?, ?, ?, ?)',
        [clientId, name, description || null, req.userEmail],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to create project' });
          }

          sendProject(db, this.lastID, res, 'created', 201);
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

        const performUpdate = () => {
          // Build update query dynamically
          const updates = [];
          const values = [];

          if (value.clientId !== undefined) {
            updates.push('client_id = ?');
            values.push(value.clientId);
          }

          if (value.name !== undefined) {
            updates.push('name = ?');
            values.push(value.name);
          }

          if (value.description !== undefined) {
            updates.push('description = ?');
            values.push(value.description || null);
          }

          updates.push('updated_at = CURRENT_TIMESTAMP');
          values.push(projectId, req.userEmail);

          const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

          db.run(query, values, function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to update project' });
            }

            sendProject(db, projectId, res, 'updated', 200);
          });
        };

        if (value.clientId !== undefined) {
          verifyClientOwnership(db, value.clientId, req.userEmail, res, performUpdate);
        } else {
          performUpdate();
        }
      }
    );
  } catch (error) {
    next(error);
  }
});

// Delete all projects for authenticated user
router.delete('/', (req, res) => {
  const db = getDatabase();

  db.run(
    'DELETE FROM projects WHERE user_email = ?',
    [req.userEmail],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to delete projects' });
      }

      res.json({
        message: 'All projects deleted successfully',
        deletedCount: this.changes
      });
    }
  );
});

// Delete project
router.delete('/:id', (req, res) => {
  const projectId = parseProjectId(req, res);
  if (projectId === null) {
    return;
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
