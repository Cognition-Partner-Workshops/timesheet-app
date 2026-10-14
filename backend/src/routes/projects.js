const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');
const { parseIdParam, handleDbError, findByIdAndUser, deleteByIdAndUser, buildUpdateQuery } = require('./helpers/crudHelpers');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_SELECT = `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
  p.created_at, p.updated_at, c.name AS client_name
  FROM projects p LEFT JOIN clients c ON p.client_id = c.id`;

function fetchProjectById(db, id, callback) {
  db.get(`${PROJECT_SELECT} WHERE p.id = ?`, [id], callback);
}

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
  const projectId = parseIdParam(req, res, 'project');
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
      [name, description || null, clientId || null, startDate || null, status, req.userEmail],
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
    const projectId = parseIdParam(req, res, 'project');
    if (projectId === null) return;

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) return next(error);

    const db = getDatabase();

    findByIdAndUser(db, 'projects', projectId, req.userEmail, (err, row) => {
      if (err) return handleDbError(res, err);
      if (!row) return res.status(404).json({ error: 'Project not found' });

      const values = [];
      const fieldMap = {
        name: value.name,
        description: value.description !== undefined ? (value.description || null) : undefined,
        client_id: value.clientId !== undefined ? (value.clientId || null) : undefined,
        start_date: value.startDate !== undefined ? (value.startDate || null) : undefined,
        status: value.status
      };
      const query = buildUpdateQuery('projects', fieldMap, values, projectId, req.userEmail);

      db.run(query, values, function(err) {
        if (err) return handleDbError(res, err, 'Failed to update project');
        fetchProjectById(db, projectId, (err, row) => {
          if (err) return handleDbError(res, err, 'Project updated but failed to retrieve');
          res.json({ message: 'Project updated successfully', project: row });
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (req, res) => {
  const projectId = parseIdParam(req, res, 'project');
  if (projectId === null) return;
  deleteByIdAndUser(getDatabase(), res, 'projects', 'Project', projectId, req.userEmail);
});

module.exports = router;
