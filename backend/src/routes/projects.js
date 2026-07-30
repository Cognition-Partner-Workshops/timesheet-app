const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');
const {
  internalError,
  findOwnedRow,
  requireReference,
  sendRow,
  buildUpdates,
  parseIdParam
} = require('../utils/dbHelpers');

const router = express.Router();

const PROJECT_COLUMNS = 'id, client_id, name, description, created_at, updated_at';
const OWNED_PROJECT = 'SELECT id FROM projects WHERE id = ? AND user_email = ?';

// All routes require authentication
router.use(authenticateUser);

function parseProjectId(req, res) {
  return parseIdParam(req, res, 'id', 'Invalid project ID');
}

function findProject(req, res, projectId, onFound) {
  findOwnedRow(getDatabase(), OWNED_PROJECT, [projectId, req.userEmail], res, 'Project not found', onFound);
}

function verifyClientOwnership(db, clientId, userEmail, res, onSuccess) {
  requireReference(
    db,
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail],
    res,
    'Client not found or does not belong to user',
    onSuccess
  );
}

function sendProject(db, projectId, res, action, status) {
  sendRow(db, `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ?`, [projectId], res, {
    key: 'project',
    entity: 'Project',
    action,
    status
  });
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
      return internalError(res, err);
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

  findOwnedRow(
    getDatabase(),
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ? AND user_email = ?`,
    [projectId, req.userEmail],
    res,
    'Project not found',
    (row) => res.json({ project: row })
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

    findProject(req, res, projectId, () => {
      const performUpdate = () => {
        const { updates, values } = buildUpdates(value, {
          clientId: ['client_id', false],
          name: ['name', false],
          description: ['description', true]
        });

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
    });
  } catch (error) {
    next(error);
  }
});

// Delete all projects for authenticated user
router.delete('/', (req, res) => {
  getDatabase().run(
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

  findProject(req, res, projectId, () => {
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
