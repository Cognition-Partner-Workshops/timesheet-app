const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema, PROJECT_STATUSES } = require('../validation/schemas');

const router = express.Router();

const PROJECT_SELECT = `
  SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
         p.created_at, p.updated_at, c.name as client_name
  FROM projects p
  JOIN clients c ON p.client_id = c.id
`;

const UPDATABLE_COLUMNS = {
  name: 'name',
  description: 'description',
  clientId: 'client_id',
  startDate: 'start_date',
  status: 'status'
};

function sendServerError(res, err, message = 'Internal server error') {
  console.error('Database error:', err);
  return res.status(500).json({ error: message });
}

function parseProjectId(req, res) {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) {
    res.status(400).json({ error: 'Invalid project ID' });
    return null;
  }
  return projectId;
}

// Calls onOwned() only if the client exists and belongs to the current user
function ensureClientOwned(db, clientId, req, res, onOwned) {
  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, row) => {
      if (err) return sendServerError(res, err);
      if (!row) return res.status(400).json({ error: 'Client not found or does not belong to user' });
      onOwned();
    }
  );
}

// Calls onOwned() only if the project exists and belongs to the current user
function ensureProjectOwned(db, projectId, req, res, onOwned) {
  db.get(
    'SELECT id FROM projects WHERE id = ? AND user_email = ?',
    [projectId, req.userEmail],
    (err, row) => {
      if (err) return sendServerError(res, err);
      if (!row) return res.status(404).json({ error: 'Project not found' });
      onOwned();
    }
  );
}

function respondWithProject(db, projectId, req, res, { status = 200, message, retrieveError }) {
  db.get(
    `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`,
    [projectId, req.userEmail],
    (err, row) => {
      if (err) return sendServerError(res, err, retrieveError);
      res.status(status).json({ message, project: row });
    }
  );
}

// All routes require authentication
router.use(authenticateUser);

// Get all projects for authenticated user (with optional client/status filters)
router.get('/', (req, res) => {
  const { clientId, status } = req.query;
  const conditions = ['p.user_email = ?'];
  const params = [req.userEmail];

  if (clientId) {
    const clientIdNum = parseInt(clientId);
    if (isNaN(clientIdNum)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    conditions.push('p.client_id = ?');
    params.push(clientIdNum);
  }

  if (status) {
    if (!PROJECT_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid project status' });
    }
    conditions.push('p.status = ?');
    params.push(status);
  }

  const query = `${PROJECT_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY p.name`;

  getDatabase().all(query, params, (err, rows) => {
    if (err) return sendServerError(res, err);
    res.json({ projects: rows });
  });
});

// Get specific project
router.get('/:id', (req, res) => {
  const projectId = parseProjectId(req, res);
  if (projectId === null) return;

  getDatabase().get(
    `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`,
    [projectId, req.userEmail],
    (err, row) => {
      if (err) return sendServerError(res, err);
      if (!row) return res.status(404).json({ error: 'Project not found' });
      res.json({ project: row });
    }
  );
});

// Create new project
router.post('/', (req, res, next) => {
  const { error, value } = projectSchema.validate(req.body);
  if (error) return next(error);

  const { name, description, clientId, startDate, status } = value;
  const db = getDatabase();

  ensureClientOwned(db, clientId, req, res, () => {
    db.run(
      'INSERT INTO projects (name, description, client_id, user_email, start_date, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, clientId, req.userEmail, startDate, status],
      function(err) {
        if (err) return sendServerError(res, err, 'Failed to create project');
        respondWithProject(db, this.lastID, req, res, {
          status: 201,
          message: 'Project created successfully',
          retrieveError: 'Project created but failed to retrieve'
        });
      }
    );
  });
});

// Update project
router.put('/:id', (req, res, next) => {
  const projectId = parseProjectId(req, res);
  if (projectId === null) return;

  const { error, value } = updateProjectSchema.validate(req.body);
  if (error) return next(error);

  const db = getDatabase();

  const performUpdate = () => {
    const fields = Object.keys(UPDATABLE_COLUMNS).filter((field) => value[field] !== undefined);
    const assignments = fields.map((field) => `${UPDATABLE_COLUMNS[field]} = ?`);
    const values = fields.map((field) => (field === 'description' ? value[field] || null : value[field]));

    assignments.push('updated_at = CURRENT_TIMESTAMP');
    values.push(projectId, req.userEmail);

    db.run(
      `UPDATE projects SET ${assignments.join(', ')} WHERE id = ? AND user_email = ?`,
      values,
      (err) => {
        if (err) return sendServerError(res, err, 'Failed to update project');
        respondWithProject(db, projectId, req, res, {
          message: 'Project updated successfully',
          retrieveError: 'Project updated but failed to retrieve'
        });
      }
    );
  };

  ensureProjectOwned(db, projectId, req, res, () => {
    if (value.clientId) {
      ensureClientOwned(db, value.clientId, req, res, performUpdate);
    } else {
      performUpdate();
    }
  });
});

// Delete project
router.delete('/:id', (req, res) => {
  const projectId = parseProjectId(req, res);
  if (projectId === null) return;

  const db = getDatabase();

  ensureProjectOwned(db, projectId, req, res, () => {
    db.run(
      'DELETE FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail],
      (err) => {
        if (err) return sendServerError(res, err, 'Failed to delete project');
        res.json({ message: 'Project deleted successfully' });
      }
    );
  });
});

module.exports = router;
