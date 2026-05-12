const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');
const { parseResourceId, handleDbError, findOwnedResource, buildDynamicUpdate } = require('./helpers');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_SELECT = `
  SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
         p.created_at, p.updated_at, c.name AS client_name
  FROM projects p
  LEFT JOIN clients c ON p.client_id = c.id`;

function fetchProjectById(db, projectId, callback) {
  db.get(`${PROJECT_SELECT} WHERE p.id = ?`, [projectId], callback);
}

const PROJECT_FIELD_MAP = {
  name: { column: 'name', nullable: false },
  description: { column: 'description', nullable: true },
  clientId: { column: 'client_id', nullable: true },
  startDate: { column: 'start_date', nullable: true },
  status: { column: 'status', nullable: false }
};

router.get('/', (req, res) => {
  const db = getDatabase();
  db.all(
    `${PROJECT_SELECT} WHERE p.user_email = ? ORDER BY p.name`,
    [req.userEmail],
    (err, rows) => {
      if (err) return handleDbError(res, err);
      res.json({ projects: rows });
    }
  );
});

router.get('/:id', (req, res) => {
  const projectId = parseResourceId(req, res, 'project');
  if (projectId === null) return;

  const db = getDatabase();
  db.get(
    `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`,
    [projectId, req.userEmail],
    (err, row) => {
      if (err) return handleDbError(res, err);
      if (!row) return res.status(404).json({ error: 'Project not found' });
      res.json({ project: row });
    }
  );
});

router.post('/', (req, res, next) => {
  try {
    const { error, value } = projectSchema.validate(req.body);
    if (error) return next(error);

    const { name, description, clientId, startDate, status } = value;
    const db = getDatabase();

    db.run(
      'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, clientId || null, startDate || null, status || 'active', req.userEmail],
      function(err) {
        if (err) return handleDbError(res, err, 'Failed to create project');
        fetchProjectById(db, this.lastID, (err, row) => {
          if (err) return handleDbError(res, err, 'Project created but failed to retrieve');
          res.status(201).json({ message: 'Project created successfully', project: row });
        });
      }
    );
  } catch (error) {
    next(error);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const projectId = parseResourceId(req, res, 'project');
    if (projectId === null) return;

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) return next(error);

    findOwnedResource('projects', projectId, req.userEmail, (err, row) => {
      if (err) return handleDbError(res, err);
      if (!row) return res.status(404).json({ error: 'Project not found' });

      const { updates, values } = buildDynamicUpdate('projects', PROJECT_FIELD_MAP, value);
      values.push(projectId, req.userEmail);

      const db = getDatabase();
      db.run(
        `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`,
        values,
        function(err) {
          if (err) return handleDbError(res, err, 'Failed to update project');
          fetchProjectById(db, projectId, (err, row) => {
            if (err) return handleDbError(res, err, 'Project updated but failed to retrieve');
            res.json({ message: 'Project updated successfully', project: row });
          });
        }
      );
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (req, res) => {
  const projectId = parseResourceId(req, res, 'project');
  if (projectId === null) return;

  findOwnedResource('projects', projectId, req.userEmail, (err, row) => {
    if (err) return handleDbError(res, err);
    if (!row) return res.status(404).json({ error: 'Project not found' });

    const db = getDatabase();
    db.run(
      'DELETE FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail],
      function(err) {
        if (err) return handleDbError(res, err, 'Failed to delete project');
        res.json({ message: 'Project deleted successfully' });
      }
    );
  });
});

module.exports = router;
