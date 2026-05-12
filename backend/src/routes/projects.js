const express = require('express');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');
const { dbAll, dbGet, dbRun, buildUpdateQuery } = require('../database/helpers');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_COLUMNS = `p.id, p.name, p.description, p.client_id, p.start_date, p.status, p.created_at, p.updated_at, c.name as client_name`;
const PROJECT_JOIN = `FROM projects p LEFT JOIN clients c ON p.client_id = c.id`;

function fetchProject(id) {
  return dbGet(`SELECT ${PROJECT_COLUMNS} ${PROJECT_JOIN} WHERE p.id = ?`, [id]);
}

router.get('/', async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT ${PROJECT_COLUMNS} ${PROJECT_JOIN} WHERE p.user_email = ? ORDER BY p.name`,
      [req.userEmail]
    );
    res.json({ projects: rows });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    const row = await dbGet(
      `SELECT ${PROJECT_COLUMNS} ${PROJECT_JOIN} WHERE p.id = ? AND p.user_email = ?`,
      [projectId, req.userEmail]
    );
    if (!row) return res.status(404).json({ error: 'Project not found' });
    res.json({ project: row });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res, next) => {
  const { error, value } = projectSchema.validate(req.body);
  if (error) return next(error);

  const { name, description, clientId, startDate, status } = value;

  try {
    const result = await dbRun(
      'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, clientId || null, startDate || null, status, req.userEmail]
    );
    const project = await fetchProject(result.lastID);
    if (!project) return res.status(500).json({ error: 'Project created but failed to retrieve' });
    res.status(201).json({ message: 'Project created successfully', project });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

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

    const fieldMap = {
      name: value.name,
      description: value.description !== undefined ? (value.description || null) : undefined,
      client_id: value.clientId !== undefined ? (value.clientId || null) : undefined,
      start_date: value.startDate !== undefined ? (value.startDate || null) : undefined,
      status: value.status
    };

    const { sql, params } = buildUpdateQuery('projects', fieldMap, projectId, req.userEmail);
    await dbRun(sql, params);

    const project = await fetchProject(projectId);
    if (!project) return res.status(500).json({ error: 'Project updated but failed to retrieve' });
    res.json({ message: 'Project updated successfully', project });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

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
