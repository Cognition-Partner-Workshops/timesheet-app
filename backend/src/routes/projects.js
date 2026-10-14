const express = require('express');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');
const { dbAll, dbGet, dbRun, buildUpdateQuery } = require('../database/helpers');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_SELECT = `
  SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.end_date,
         p.status, p.budget_hours, p.created_at, p.updated_at, c.name as client_name
  FROM projects p
  JOIN clients c ON p.client_id = c.id`;

async function verifyClientOwnership(clientId, userEmail) {
  return dbGet('SELECT id FROM clients WHERE id = ? AND user_email = ?', [clientId, userEmail]);
}

async function fetchProject(id) {
  return dbGet(`${PROJECT_SELECT} WHERE p.id = ?`, [id]);
}

router.get('/', async (req, res) => {
  try {
    const { clientId, status } = req.query;
    let query = `${PROJECT_SELECT} WHERE p.user_email = ?`;
    const params = [req.userEmail];

    if (clientId) {
      const clientIdNum = parseInt(clientId);
      if (isNaN(clientIdNum)) {
        return res.status(400).json({ error: 'Invalid client ID' });
      }
      query += ' AND p.client_id = ?';
      params.push(clientIdNum);
    }

    if (status) {
      if (!['active', 'completed', 'on-hold'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be one of: active, completed, on-hold' });
      }
      query += ' AND p.status = ?';
      params.push(status);
    }

    query += ' ORDER BY p.created_at DESC';
    const rows = await dbAll(query, params);
    res.json({ projects: rows });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const row = await dbGet(`${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`, [projectId, req.userEmail]);
    if (!row) {
      return res.status(404).json({ error: 'Project not found' });
    }
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

    const { name, description, clientId, startDate, endDate, status, budgetHours } = value;

    const client = await verifyClientOwnership(clientId, req.userEmail);
    if (!client) {
      return res.status(400).json({ error: 'Client not found or does not belong to user' });
    }

    const result = await dbRun(
      `INSERT INTO projects (name, description, client_id, start_date, end_date, status, budget_hours, user_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description || null, clientId, startDate || null, endDate || null, status || 'active', budgetHours || null, req.userEmail]
    );

    const project = await fetchProject(result.lastID);
    if (!project) {
      return res.status(500).json({ error: 'Project created but failed to retrieve' });
    }
    res.status(201).json({ message: 'Project created successfully', project });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) return next(error);

    const existing = await dbGet('SELECT id FROM projects WHERE id = ? AND user_email = ?', [projectId, req.userEmail]);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (value.clientId !== undefined) {
      const client = await verifyClientOwnership(value.clientId, req.userEmail);
      if (!client) {
        return res.status(400).json({ error: 'Client not found or does not belong to user' });
      }
    }

    const fieldMap = {
      name: value.name,
      description: value.description !== undefined ? (value.description || null) : undefined,
      client_id: value.clientId,
      start_date: value.startDate !== undefined ? (value.startDate || null) : undefined,
      end_date: value.endDate !== undefined ? (value.endDate || null) : undefined,
      status: value.status,
      budget_hours: value.budgetHours !== undefined ? (value.budgetHours || null) : undefined,
    };

    const { query, values } = buildUpdateQuery('projects', fieldMap, projectId, req.userEmail);
    await dbRun(query, values);

    const project = await fetchProject(projectId);
    if (!project) {
      return res.status(500).json({ error: 'Project updated but failed to retrieve' });
    }
    res.json({ message: 'Project updated successfully', project });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const existing = await dbGet('SELECT id FROM projects WHERE id = ? AND user_email = ?', [projectId, req.userEmail]);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await dbRun('DELETE FROM projects WHERE id = ? AND user_email = ?', [projectId, req.userEmail]);
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
