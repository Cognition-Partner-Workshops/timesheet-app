const express = require('express');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');
const { validateId, dbAll, dbGet, dbRun, buildUpdateQuery } = require('./helpers');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_SELECT = `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
  p.created_at, p.updated_at, c.name as client_name
  FROM projects p LEFT JOIN clients c ON p.client_id = c.id`;

const UPDATE_FIELDS = [
  { key: 'name', column: 'name' },
  { key: 'description', column: 'description' },
  { key: 'clientId', column: 'client_id' },
  { key: 'startDate', column: 'start_date' },
  { key: 'status', column: 'status' },
];

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

router.get('/:id', async (req, res) => {
  const projectId = validateId(req);
  if (!projectId) return res.status(400).json({ error: 'Invalid project ID' });

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

router.post('/', async (req, res, next) => {
  const { error, value } = projectSchema.validate(req.body);
  if (error) return next(error);

  try {
    const { name, description, clientId, startDate, status } = value;
    const result = await dbRun(
      'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, clientId || null, startDate || null, status || 'active', req.userEmail]
    );
    const project = await dbGet(`${PROJECT_SELECT} WHERE p.id = ?`, [result.lastID]);
    res.status(201).json({ message: 'Project created successfully', project });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/:id', async (req, res, next) => {
  const projectId = validateId(req);
  if (!projectId) return res.status(400).json({ error: 'Invalid project ID' });

  const { error, value } = updateProjectSchema.validate(req.body);
  if (error) return next(error);

  try {
    const existing = await dbGet(
      'SELECT id FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail]
    );
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    const { query, values } = buildUpdateQuery('projects', UPDATE_FIELDS, value, 'id', projectId, req.userEmail);
    await dbRun(query, values);
    const project = await dbGet(`${PROJECT_SELECT} WHERE p.id = ?`, [projectId]);
    res.json({ message: 'Project updated successfully', project });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/', async (req, res) => {
  try {
    const result = await dbRun('DELETE FROM projects WHERE user_email = ?', [req.userEmail]);
    res.json({ message: 'All projects deleted successfully', deletedCount: result.changes });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to delete projects' });
  }
});

router.delete('/:id', async (req, res) => {
  const projectId = validateId(req);
  if (!projectId) return res.status(400).json({ error: 'Invalid project ID' });

  try {
    const existing = await dbGet(
      'SELECT id FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail]
    );
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    await dbRun('DELETE FROM projects WHERE id = ? AND user_email = ?', [projectId, req.userEmail]);
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
