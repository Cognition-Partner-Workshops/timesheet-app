const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');
const { parseId, buildUpdateQuery, dbAll, dbGet, dbRun } = require('../utils/routeHelpers');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_SELECT = `
  SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
         p.created_at, p.updated_at, c.name AS client_name
  FROM projects p LEFT JOIN clients c ON p.client_id = c.id`;

const UPDATE_FIELDS = [
  { column: 'name', key: 'name' },
  { column: 'description', key: 'description', transform: v => v || null },
  { column: 'client_id', key: 'clientId', transform: v => v || null },
  { column: 'start_date', key: 'startDate', transform: v => v || null },
  { column: 'status', key: 'status' }
];

router.get('/', async (req, res) => {
  try {
    const rows = await dbAll(getDatabase(), `${PROJECT_SELECT} WHERE p.user_email = ? ORDER BY p.name`, [req.userEmail]);
    res.json({ projects: rows });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  const projectId = parseId(req, res, 'project');
  if (projectId === null) return;

  try {
    const row = await dbGet(getDatabase(), `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`, [projectId, req.userEmail]);
    if (!row) return res.status(404).json({ error: 'Project not found' });
    res.json({ project: row });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = projectSchema.validate(req.body);
    if (error) return next(error);

    const { name, description, clientId, startDate, status } = value;
    const db = getDatabase();

    const result = await dbRun(db,
      'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, clientId || null, startDate || null, status, req.userEmail]
    );

    const row = await dbGet(db, `${PROJECT_SELECT} WHERE p.id = ?`, [result.lastID]);
    if (!row) return res.status(500).json({ error: 'Project created but failed to retrieve' });

    res.status(201).json({ message: 'Project created successfully', project: row });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const projectId = parseId(req, res, 'project');
    if (projectId === null) return;

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) return next(error);

    const db = getDatabase();
    const existing = await dbGet(db, 'SELECT id FROM projects WHERE id = ? AND user_email = ?', [projectId, req.userEmail]);
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    const { query, values } = buildUpdateQuery('projects', UPDATE_FIELDS, value, projectId, req.userEmail);
    await dbRun(db, query, values);

    const row = await dbGet(db, `${PROJECT_SELECT} WHERE p.id = ?`, [projectId]);
    if (!row) return res.status(500).json({ error: 'Project updated but failed to retrieve' });

    res.json({ message: 'Project updated successfully', project: row });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/', async (req, res) => {
  try {
    const result = await dbRun(getDatabase(), 'DELETE FROM projects WHERE user_email = ?', [req.userEmail]);
    res.json({ message: 'All projects deleted successfully', deletedCount: result.changes });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to delete projects' });
  }
});

router.delete('/:id', async (req, res) => {
  const projectId = parseId(req, res, 'project');
  if (projectId === null) return;

  try {
    const db = getDatabase();
    const existing = await dbGet(db, 'SELECT id FROM projects WHERE id = ? AND user_email = ?', [projectId, req.userEmail]);
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    await dbRun(db, 'DELETE FROM projects WHERE id = ? AND user_email = ?', [projectId, req.userEmail]);
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
