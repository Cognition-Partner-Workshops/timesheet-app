const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');
const { parseId, findOwned, buildUpdateQuery } = require('./helpers');

const router = express.Router();

const PROJECT_SELECT = `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
  p.created_at, p.updated_at, c.name as client_name
  FROM projects p LEFT JOIN clients c ON p.client_id = c.id`;

router.use(authenticateUser);

function verifyClientOwnership(db, clientId, userEmail) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM clients WHERE id = ? AND user_email = ?',
      [clientId, userEmail],
      (err, row) => err ? reject(err) : resolve(row));
  });
}

function fetchProject(db, id) {
  return new Promise((resolve, reject) => {
    db.get(`${PROJECT_SELECT} WHERE p.id = ?`, [id],
      (err, row) => err ? reject(err) : resolve(row));
  });
}

router.get('/', (req, res) => {
  const db = getDatabase();
  db.all(`${PROJECT_SELECT} WHERE p.user_email = ? ORDER BY p.created_at DESC`,
    [req.userEmail],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ projects: rows });
    }
  );
});

router.get('/:id', (req, res) => {
  const projectId = parseId(req, res, 'project');
  if (!projectId) return;

  const db = getDatabase();
  db.get(`${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`,
    [projectId, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!row) return res.status(404).json({ error: 'Project not found' });
      res.json({ project: row });
    }
  );
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = projectSchema.validate(req.body);
    if (error) return next(error);

    const { name, description, clientId, startDate, status } = value;
    const db = getDatabase();

    if (clientId) {
      try {
        const client = await verifyClientOwnership(db, clientId, req.userEmail);
        if (!client) return res.status(400).json({ error: 'Client not found' });
      } catch (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    db.run(
      'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, clientId || null, startDate, status, req.userEmail],
      async function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to create project' });
        }
        try {
          const project = await fetchProject(db, this.lastID);
          res.status(201).json({ message: 'Project created successfully', project });
        } catch (fetchErr) {
          console.error('Database error:', fetchErr);
          res.status(500).json({ error: 'Project created but failed to retrieve' });
        }
      }
    );
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const projectId = parseId(req, res, 'project');
    if (!projectId) return;

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) return next(error);

    const db = getDatabase();

    try {
      const existing = await findOwned('projects', projectId, req.userEmail);
      if (!existing) return res.status(404).json({ error: 'Project not found' });
    } catch (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (value.clientId !== undefined && value.clientId !== null) {
      try {
        const client = await verifyClientOwnership(db, value.clientId, req.userEmail);
        if (!client) return res.status(400).json({ error: 'Client not found' });
      } catch (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    const fieldMap = {
      name: value.name,
      description: value.description !== undefined ? (value.description || null) : undefined,
      client_id: value.clientId,
      start_date: value.startDate,
      status: value.status
    };
    const { sql, params } = buildUpdateQuery('projects', fieldMap, projectId, req.userEmail);

    db.run(sql, params, async function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to update project' });
      }
      try {
        const project = await fetchProject(db, projectId);
        res.json({ message: 'Project updated successfully', project });
      } catch (fetchErr) {
        console.error('Database error:', fetchErr);
        res.status(500).json({ error: 'Project updated but failed to retrieve' });
      }
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res) => {
  const projectId = parseId(req, res, 'project');
  if (!projectId) return;

  const db = getDatabase();

  try {
    const existing = await findOwned('projects', projectId, req.userEmail);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }

  db.run('DELETE FROM projects WHERE id = ? AND user_email = ?',
    [projectId, req.userEmail],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to delete project' });
      }
      res.json({ message: 'Project deleted successfully' });
    }
  );
});

module.exports = router;
