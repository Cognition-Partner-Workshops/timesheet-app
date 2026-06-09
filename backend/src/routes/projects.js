const express = require('express');
const { dbAll, dbGet, dbRun, buildDynamicUpdate } = require('../database/helpers');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_SELECT = `
  SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
         p.created_at, p.updated_at, c.name as client_name
  FROM projects p
  LEFT JOIN clients c ON p.client_id = c.id`;

async function verifyClientOwnership(clientId, userEmail) {
  if (!clientId) return true;
  const row = await dbGet(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail]
  );
  return !!row;
}

// List all projects
router.get('/', async (req, res) => {
  try {
    const rows = await dbAll(
      `${PROJECT_SELECT} WHERE p.user_email = ? ORDER BY p.name`,
      [req.userEmail]
    );
    res.json({ projects: rows });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single project
router.get('/:id', async (req, res) => {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    const row = await dbGet(
      `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`,
      [projectId, req.userEmail]
    );
    if (!row) return res.status(404).json({ error: 'Project not found' });
    res.json({ project: row });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create project
router.post('/', async (req, res, next) => {
  const { error, value } = projectSchema.validate(req.body);
  if (error) return next(error);

  const { name, description, clientId, startDate, status } = value;

  try {
    if (clientId && !(await verifyClientOwnership(clientId, req.userEmail))) {
      return res.status(400).json({ error: 'Client not found or does not belong to user' });
    }

    const { lastID } = await dbRun(
      'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, clientId || null, startDate || null, status || 'active', req.userEmail]
    );

    const row = await dbGet(`${PROJECT_SELECT} WHERE p.id = ?`, [lastID]);
    res.status(201).json({ message: 'Project created successfully', project: row });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.put('/:id', async (req, res, next) => {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const { error, value } = updateProjectSchema.validate(req.body);
  if (error) return next(error);

  try {
    const existing = await dbGet(
      'SELECT id FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail]
    );
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    if (value.clientId && !(await verifyClientOwnership(value.clientId, req.userEmail))) {
      return res.status(400).json({ error: 'Client not found or does not belong to user' });
    }

    const fields = {};
    if (value.name !== undefined) fields.name = value.name;
    if (value.description !== undefined) fields.description = value.description || null;
    if (value.clientId !== undefined) fields.client_id = value.clientId || null;
    if (value.startDate !== undefined) fields.start_date = value.startDate || null;
    if (value.status !== undefined) fields.status = value.status;

    const { query, values } = buildDynamicUpdate('projects', fields, projectId, req.userEmail);
    await dbRun(query, values);

    const row = await dbGet(`${PROJECT_SELECT} WHERE p.id = ?`, [projectId]);
    res.json({ message: 'Project updated successfully', project: row });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    const existing = await dbGet(
      'SELECT id FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail]
    );
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    await dbRun(
      'DELETE FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail]
    );
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
