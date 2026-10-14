const express = require('express');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');
const { findAll, findOne, runQuery, buildUpdateQuery } = require('../database/helpers');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_SELECT = `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status, p.user_email, p.created_at, p.updated_at, c.name as client_name
FROM projects p LEFT JOIN clients c ON p.client_id = c.id`;

router.get('/', async (req, res) => {
  try {
    const rows = await findAll(
      `${PROJECT_SELECT} WHERE p.user_email = ? ORDER BY p.created_at DESC`,
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
    const project = await findOne(
      `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`,
      [projectId, req.userEmail]
    );
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ project });
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

    if (clientId) {
      const client = await findOne(
        'SELECT id FROM clients WHERE id = ? AND user_email = ?',
        [clientId, req.userEmail]
      );
      if (!client) {
        return res.status(400).json({ error: 'Client not found or does not belong to you' });
      }
    }

    const result = await runQuery(
      'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, clientId || null, startDate || null, status || 'active', req.userEmail]
    );

    const project = await findOne(`${PROJECT_SELECT} WHERE p.id = ?`, [result.lastID]);
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
    const existing = await findOne(
      'SELECT id FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (value.clientId) {
      const client = await findOne(
        'SELECT id FROM clients WHERE id = ? AND user_email = ?',
        [value.clientId, req.userEmail]
      );
      if (!client) {
        return res.status(400).json({ error: 'Client not found or does not belong to you' });
      }
    }

    const fieldMap = {
      name: value.name,
      description: value.description !== undefined ? (value.description || null) : undefined,
      client_id: value.clientId !== undefined ? (value.clientId || null) : undefined,
      start_date: value.startDate !== undefined ? (value.startDate || null) : undefined,
      status: value.status
    };

    const { query, values } = buildUpdateQuery('projects', fieldMap, 'id = ? AND user_email = ?');
    values.push(projectId, req.userEmail);
    await runQuery(query, values);

    const project = await findOne(`${PROJECT_SELECT} WHERE p.id = ?`, [projectId]);
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
    const existing = await findOne(
      'SELECT id FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await runQuery(
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
