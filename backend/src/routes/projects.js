const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_SELECT = `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
  p.created_at, p.updated_at, c.name AS client_name
  FROM projects p LEFT JOIN clients c ON p.client_id = c.id`;

function dbGet(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function dbAll(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function dbRun(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function parseId(req, res, label) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: `Invalid ${label} ID` });
    return null;
  }
  return id;
}

async function verifyClientOwnership(db, clientId, userEmail) {
  if (!clientId) return true;
  const row = await dbGet(db, 'SELECT id FROM clients WHERE id = ? AND user_email = ?', [clientId, userEmail]);
  return !!row;
}

function formatDate(d) {
  return d ? new Date(d).toISOString().split('T')[0] : null;
}

router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const rows = await dbAll(db, `${PROJECT_SELECT} WHERE p.user_email = ? ORDER BY p.name`, [req.userEmail]);
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
    const db = getDatabase();
    const row = await dbGet(db, `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`, [projectId, req.userEmail]);
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

    const { name, description, client_id, start_date, status } = value;
    const db = getDatabase();

    if (client_id && !(await verifyClientOwnership(db, client_id, req.userEmail))) {
      return res.status(400).json({ error: 'Client not found' });
    }

    const result = await dbRun(db,
      'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, client_id || null, formatDate(start_date), status, req.userEmail]
    );

    const row = await dbGet(db, `${PROJECT_SELECT} WHERE p.id = ?`, [result.lastID]);
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

    if (value.client_id !== undefined && value.client_id !== null) {
      if (!(await verifyClientOwnership(db, value.client_id, req.userEmail))) {
        return res.status(400).json({ error: 'Client not found' });
      }
    }

    const fieldMap = {
      name: value.name,
      description: value.description !== undefined ? (value.description || null) : undefined,
      client_id: value.client_id,
      start_date: value.start_date !== undefined ? formatDate(value.start_date) : undefined,
      status: value.status,
    };

    const updates = [];
    const values = [];
    for (const [col, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        updates.push(`${col} = ?`);
        values.push(val);
      }
    }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(projectId, req.userEmail);

    await dbRun(db, `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`, values);
    const row = await dbGet(db, `${PROJECT_SELECT} WHERE p.id = ?`, [projectId]);
    res.json({ message: 'Project updated successfully', project: row });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to update project' });
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
