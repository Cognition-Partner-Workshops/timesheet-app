const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Load a project owned by the user, responding with 404/500 when it cannot be used
function findUserProject(db, res, projectId, userEmail, onFound) {
  db.get(
    'SELECT id FROM projects WHERE id = ? AND user_email = ?',
    [projectId, userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Project not found' });
      }
      onFound();
    }
  );
}

// Ensure an assigned client belongs to the user before persisting a project
function verifyClientOwnership(db, res, clientId, userEmail, onOk) {
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
      onOk();
    }
  );
}

// Apply a validated set of updates to a project and return the refreshed row
function executeProjectUpdate(db, res, projectId, userEmail, value) {
  const updates = [];
  const values = [];

  if (value.name !== undefined) {
    updates.push('name = ?');
    values.push(value.name);
  }

  if (value.description !== undefined) {
    updates.push('description = ?');
    values.push(value.description || null);
  }

  if (value.clientId !== undefined) {
    updates.push('client_id = ?');
    values.push(value.clientId || null);
  }

  if (value.startDate !== undefined) {
    updates.push('start_date = ?');
    values.push(value.startDate || null);
  }

  if (value.status !== undefined) {
    updates.push('status = ?');
    values.push(value.status);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(projectId, userEmail);

  const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

  db.run(query, values, (err) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to update project' });
    }

    db.get(`${SELECT_FIELDS} WHERE p.id = ?`, [projectId], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Project updated but failed to retrieve' });
      }

      res.json({
        message: 'Project updated successfully',
        project: row
      });
    });
  });
}

const SELECT_FIELDS = `
  SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
         p.created_at, p.updated_at, c.name as client_name
  FROM projects p
  LEFT JOIN clients c ON p.client_id = c.id
`;

// Get all projects for authenticated user
router.get('/', (req, res) => {
  const db = getDatabase();

  db.all(
    `${SELECT_FIELDS} WHERE p.user_email = ? ORDER BY p.name`,
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
  const projectId = Number.parseInt(req.params.id);

  if (Number.isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const db = getDatabase();

  db.get(
    `${SELECT_FIELDS} WHERE p.id = ? AND p.user_email = ?`,
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

    const insert = () => {
      db.run(
        'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || null, clientId || null, startDate || null, status || 'active', req.userEmail],
        function (err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to create project' });
          }

          db.get(
            `${SELECT_FIELDS} WHERE p.id = ?`,
            [this.lastID],
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
    };

    // If a client is assigned, verify it belongs to the user
    if (clientId) {
      verifyClientOwnership(db, res, clientId, req.userEmail, insert);
    } else {
      insert();
    }
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

    findUserProject(db, res, projectId, req.userEmail, () => {
      const applyUpdate = () => executeProjectUpdate(db, res, projectId, req.userEmail, value);

      // If clientId is being set to a client, verify it belongs to user
      if (value.clientId) {
        verifyClientOwnership(db, res, value.clientId, req.userEmail, applyUpdate);
      } else {
        applyUpdate();
      }
    });
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
    function (err) {
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
  const projectId = Number.parseInt(req.params.id);

  if (Number.isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const db = getDatabase();

  findUserProject(db, res, projectId, req.userEmail, () => {
    db.run(
      'DELETE FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail],
      (err) => {
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
