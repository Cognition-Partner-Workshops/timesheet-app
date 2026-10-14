const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');
const { parseId, validateBody, findOwned, buildUpdateQuery } = require('./crudHelpers');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_SELECT = `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
  p.created_at, p.updated_at, c.name as client_name
  FROM projects p LEFT JOIN clients c ON p.client_id = c.id`;

const FIELD_MAP = {
  name: 'name',
  description: 'description',
  clientId: 'client_id',
  startDate: 'start_date',
  status: 'status',
};

function fetchProject(id, callback) {
  getDatabase().get(`${PROJECT_SELECT} WHERE p.id = ?`, [id], callback);
}

router.get('/', (req, res) => {
  getDatabase().all(
    `${PROJECT_SELECT} WHERE p.user_email = ? ORDER BY p.name`,
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
  const id = parseId(req, res, 'project');
  if (id === null) return;

  getDatabase().get(
    `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`,
    [id, req.userEmail],
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

router.post('/', (req, res, next) => {
  const value = validateBody(projectSchema, req, res, next);
  if (!value) return;

  const { name, description, clientId, startDate, status } = value;

  getDatabase().run(
    'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
    [name, description || null, clientId || null, startDate || null, status, req.userEmail],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to create project' });
      }
      fetchProject(this.lastID, (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Project created but failed to retrieve' });
        }
        res.status(201).json({ message: 'Project created successfully', project: row });
      });
    }
  );
});

router.put('/:id', (req, res, next) => {
  const id = parseId(req, res, 'project');
  if (id === null) return;

  const value = validateBody(updateProjectSchema, req, res, next);
  if (!value) return;

  findOwned('projects', id, req.userEmail, (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!row) return res.status(404).json({ error: 'Project not found' });

    const { updates, values } = buildUpdateQuery('projects', FIELD_MAP, value);
    values.push(id, req.userEmail);

    getDatabase().run(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`,
      values,
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to update project' });
        }
        fetchProject(id, (err, row) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Project updated but failed to retrieve' });
          }
          res.json({ message: 'Project updated successfully', project: row });
        });
      }
    );
  });
});

router.delete('/:id', (req, res) => {
  const id = parseId(req, res, 'project');
  if (id === null) return;

  findOwned('projects', id, req.userEmail, (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!row) return res.status(404).json({ error: 'Project not found' });

    getDatabase().run(
      'DELETE FROM projects WHERE id = ? AND user_email = ?',
      [id, req.userEmail],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to delete project' });
        }
        res.json({ message: 'Project deleted successfully' });
      }
    );
  });
});

module.exports = router;
