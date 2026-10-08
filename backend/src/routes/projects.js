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

// Maps request fields to project columns for INSERT/UPDATE
const PROJECT_COLUMNS = {
  name: { column: 'name', toDb: (v) => v },
  description: { column: 'description', toDb: (v) => v || null },
  clientId: { column: 'client_id', toDb: (v) => v },
  startDate: { column: 'start_date', toDb: (v) => v },
  status: { column: 'status', toDb: (v) => v }
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const query = (method, sql, params, failureMessage) =>
  new Promise((resolve, reject) => {
    getDatabase()[method](sql, params, function(err, result) {
      if (err) {
        console.error('Database error:', err);
        return reject(new HttpError(500, failureMessage));
      }
      resolve(method === 'run' ? this : result);
    });
  });

const asyncHandler = (handler) => (req, res, next) =>
  handler(req, res).catch((err) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  });

const validate = (schema, body) => {
  const { error, value } = schema.validate(body);
  if (error) {
    throw error;
  }
  return value;
};

const parseStrictId = (rawId, message) => {
  if (typeof rawId !== 'string' || !/^[1-9]\d*$/.test(rawId)) {
    throw new HttpError(400, message);
  }

  const projectId = Number(rawId);
  if (!Number.isSafeInteger(projectId)) {
    throw new HttpError(400, message);
  }

  return projectId;
};

const assertClientOwnedByUser = async (clientId, userEmail) => {
  const client = await query(
    'get',
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail],
    'Internal server error'
  );
  if (!client) {
    throw new HttpError(400, 'Client not found or does not belong to user');
  }
};

const assertProjectExists = async (projectId, userEmail) => {
  const project = await query(
    'get',
    'SELECT id FROM projects WHERE id = ? AND user_email = ?',
    [projectId, userEmail],
    'Internal server error'
  );
  if (!project) {
    throw new HttpError(404, 'Project not found');
  }
};

const fetchProject = (projectId, userEmail, failureMessage) =>
  query('get', `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`, [projectId, userEmail], failureMessage);

// All routes require authentication
router.use(authenticateUser);

// Get all projects for authenticated user (with optional client/status filters)
router.get('/', asyncHandler(async (req, res) => {
  const { clientId, status } = req.query;
  const conditions = ['p.user_email = ?'];
  const params = [req.userEmail];

  if (clientId) {
    const clientIdNum = parseStrictId(clientId, 'Invalid client ID');
    conditions.push('p.client_id = ?');
    params.push(clientIdNum);
  }

  if (status) {
    if (!PROJECT_STATUSES.includes(status)) {
      throw new HttpError(400, 'Invalid project status');
    }
    conditions.push('p.status = ?');
    params.push(status);
  }

  const projects = await query(
    'all',
    `${PROJECT_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY p.name`,
    params,
    'Internal server error'
  );
  res.json({ projects });
}));

// Get specific project
router.get('/:id', asyncHandler(async (req, res) => {
  const projectId = parseStrictId(req.params.id, 'Invalid project ID');
  const project = await fetchProject(projectId, req.userEmail, 'Internal server error');
  if (!project) {
    throw new HttpError(404, 'Project not found');
  }
  res.json({ project });
}));

// Create new project
router.post('/', asyncHandler(async (req, res) => {
  const value = validate(projectSchema, req.body);
  await assertClientOwnedByUser(value.clientId, req.userEmail);

  const fields = Object.keys(PROJECT_COLUMNS);
  const columns = [...fields.map((field) => PROJECT_COLUMNS[field].column), 'user_email'];
  const values = [...fields.map((field) => PROJECT_COLUMNS[field].toDb(value[field])), req.userEmail];

  const { lastID } = await query(
    'run',
    `INSERT INTO projects (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    values,
    'Failed to create project'
  );

  const project = await fetchProject(lastID, req.userEmail, 'Project created but failed to retrieve');
  res.status(201).json({ message: 'Project created successfully', project });
}));

// Update project
router.put('/:id', asyncHandler(async (req, res) => {
  const projectId = parseStrictId(req.params.id, 'Invalid project ID');
  const value = validate(updateProjectSchema, req.body);

  await assertProjectExists(projectId, req.userEmail);
  if (value.clientId) {
    await assertClientOwnedByUser(value.clientId, req.userEmail);
  }

  const fields = Object.keys(PROJECT_COLUMNS).filter((field) => value[field] !== undefined);
  const assignments = [...fields.map((field) => `${PROJECT_COLUMNS[field].column} = ?`), 'updated_at = CURRENT_TIMESTAMP'];
  const values = fields.map((field) => PROJECT_COLUMNS[field].toDb(value[field]));

  await query(
    'run',
    `UPDATE projects SET ${assignments.join(', ')} WHERE id = ? AND user_email = ?`,
    [...values, projectId, req.userEmail],
    'Failed to update project'
  );

  const project = await fetchProject(projectId, req.userEmail, 'Project updated but failed to retrieve');
  res.json({ message: 'Project updated successfully', project });
}));

// Delete project
router.delete('/:id', asyncHandler(async (req, res) => {
  const projectId = parseStrictId(req.params.id, 'Invalid project ID');
  await assertProjectExists(projectId, req.userEmail);
  await query(
    'run',
    'DELETE FROM projects WHERE id = ? AND user_email = ?',
    [projectId, req.userEmail],
    'Failed to delete project'
  );
  res.json({ message: 'Project deleted successfully' });
}));

module.exports = router;
