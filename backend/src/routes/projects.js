const express = require('express');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');
const { dbAll, dbGet, dbRun, parseResourceId, buildDynamicUpdate } = require('../database/helpers');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_SELECT = `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
  p.created_at, p.updated_at, c.name as client_name
  FROM projects p LEFT JOIN clients c ON p.client_id = c.id`;

const PROJECT_FIELDS = [
  { field: 'name', column: 'name', nullable: false },
  { field: 'description', column: 'description', nullable: true },
  { field: 'clientId', column: 'client_id', nullable: true },
  { field: 'startDate', column: 'start_date', nullable: true },
  { field: 'status', column: 'status', nullable: false },
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
  const { id, error: idError } = parseResourceId(req.params.id, 'project');
  if (idError) return res.status(400).json({ error: idError });

  try {
    const row = await dbGet(
      `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`,
      [id, req.userEmail]
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
    const { lastID } = await dbRun(
      'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, clientId || null, startDate || null, status, req.userEmail]
    );

    const row = await dbGet(`${PROJECT_SELECT} WHERE p.id = ?`, [lastID]);
    res.status(201).json({ message: 'Project created successfully', project: row });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/:id', async (req, res, next) => {
  const { id, error: idError } = parseResourceId(req.params.id, 'project');
  if (idError) return res.status(400).json({ error: idError });

  const { error, value } = updateProjectSchema.validate(req.body);
  if (error) return next(error);

  try {
    const existing = await dbGet(
      'SELECT id FROM projects WHERE id = ? AND user_email = ?',
      [id, req.userEmail]
    );
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    const { setClauses, values } = buildDynamicUpdate('projects', PROJECT_FIELDS, value);
    await dbRun(
      `UPDATE projects SET ${setClauses} WHERE id = ? AND user_email = ?`,
      [...values, id, req.userEmail]
    );

    const row = await dbGet(`${PROJECT_SELECT} WHERE p.id = ?`, [id]);
    res.json({ message: 'Project updated successfully', project: row });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/', async (req, res) => {
  try {
    const { changes } = await dbRun(
      'DELETE FROM projects WHERE user_email = ?',
      [req.userEmail]
    );
    res.json({ message: 'All projects deleted successfully', deletedCount: changes });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to delete projects' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id, error: idError } = parseResourceId(req.params.id, 'project');
  if (idError) return res.status(400).json({ error: idError });

  try {
    const existing = await dbGet(
      'SELECT id FROM projects WHERE id = ? AND user_email = ?',
      [id, req.userEmail]
    );
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    await dbRun(
      'DELETE FROM projects WHERE id = ? AND user_email = ?',
      [id, req.userEmail]
    );
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
