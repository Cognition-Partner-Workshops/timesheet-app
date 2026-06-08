const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();
router.use(authenticateUser);

// Promisified DB helpers to avoid callback duplication with other route files
const dbAll = (db, sql, params) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

const dbGet = (db, sql, params) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  );

const dbRun = (db, sql, params) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    })
  );

function normalizeDate(val) {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function parseId(raw) {
  const n = parseInt(raw);
  return isNaN(n) ? null : n;
}

const PROJECT_COLS = `
  p.id, p.name, p.description, p.client_id, p.start_date, p.status,
  p.created_at, p.updated_at, c.name as client_name
`;
const FROM_PROJECTS = `FROM projects p LEFT JOIN clients c ON p.client_id = c.id`;

// List all projects for the authenticated user
router.get('/', async (req, res) => {
  try {
    const rows = await dbAll(
      getDatabase(),
      `SELECT ${PROJECT_COLS} ${FROM_PROJECTS} WHERE p.user_email = ? ORDER BY p.name`,
      [req.userEmail]
    );
    res.json({ projects: rows });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single project by ID
router.get('/:id', async (req, res) => {
  const projectId = parseId(req.params.id);
  if (!projectId) return res.status(400).json({ error: 'Invalid project ID' });

  try {
    const row = await dbGet(
      getDatabase(),
      `SELECT ${PROJECT_COLS} ${FROM_PROJECTS} WHERE p.id = ? AND p.user_email = ?`,
      [projectId, req.userEmail]
    );
    if (!row) return res.status(404).json({ error: 'Project not found' });
    res.json({ project: row });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a project
router.post('/', async (req, res, next) => {
  const { error, value } = projectSchema.validate(req.body);
  if (error) return next(error);

  const { name, description, clientId, startDate, status } = value;
  const db = getDatabase();

  try {
    const { lastID } = await dbRun(db,
      'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, clientId || null, normalizeDate(startDate), status || 'active', req.userEmail]
    );
    const project = await dbGet(db, `SELECT ${PROJECT_COLS} ${FROM_PROJECTS} WHERE p.id = ?`, [lastID]);
    if (!project) return res.status(500).json({ error: 'Project created but failed to retrieve' });
    res.status(201).json({ message: 'Project created successfully', project });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update a project
router.put('/:id', async (req, res, next) => {
  const projectId = parseId(req.params.id);
  if (!projectId) return res.status(400).json({ error: 'Invalid project ID' });

  const { error, value } = updateProjectSchema.validate(req.body);
  if (error) return next(error);

  const db = getDatabase();

  try {
    const existing = await dbGet(db,
      'SELECT id FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail]
    );
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    const fieldMap = {
      name: { col: 'name', transform: (v) => v },
      description: { col: 'description', transform: (v) => v || null },
      clientId: { col: 'client_id', transform: (v) => v || null },
      startDate: { col: 'start_date', transform: normalizeDate },
      status: { col: 'status', transform: (v) => v },
    };

    const setClauses = [];
    const params = [];
    for (const [key, { col, transform }] of Object.entries(fieldMap)) {
      if (value[key] !== undefined) {
        setClauses.push(`${col} = ?`);
        params.push(transform(value[key]));
      }
    }
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(projectId, req.userEmail);

    await dbRun(db, `UPDATE projects SET ${setClauses.join(', ')} WHERE id = ? AND user_email = ?`, params);

    const project = await dbGet(db, `SELECT ${PROJECT_COLS} ${FROM_PROJECTS} WHERE p.id = ?`, [projectId]);
    if (!project) return res.status(500).json({ error: 'Project updated but failed to retrieve' });
    res.json({ message: 'Project updated successfully', project });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete all projects for the authenticated user
router.delete('/', async (req, res) => {
  try {
    const { changes } = await dbRun(getDatabase(),
      'DELETE FROM projects WHERE user_email = ?',
      [req.userEmail]
    );
    res.json({ message: 'All projects deleted successfully', deletedCount: changes });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to delete projects' });
  }
});

// Delete a single project by ID
router.delete('/:id', async (req, res) => {
  const projectId = parseId(req.params.id);
  if (!projectId) return res.status(400).json({ error: 'Invalid project ID' });

  const db = getDatabase();

  try {
    const existing = await dbGet(db,
      'SELECT id FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail]
    );
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    await dbRun(db, 'DELETE FROM projects WHERE id = ? AND user_email = ?', [projectId, req.userEmail]);
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
