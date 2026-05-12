const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');
const { parseId, checkOwnership, verifyClientBelongsToUser, buildUpdateQuery } = require('./helpers');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_SELECT = `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
        p.created_at, p.updated_at, c.name as client_name
 FROM projects p
 LEFT JOIN clients c ON p.client_id = c.id`;

const UPDATE_FIELDS = [
  { key: 'name', column: 'name' },
  { key: 'description', column: 'description' },
  { key: 'clientId', column: 'client_id' },
  { key: 'startDate', column: 'start_date' },
  { key: 'status', column: 'status' }
];

const buildProjectUpdate = buildUpdateQuery('projects', UPDATE_FIELDS, 'id', 'user_email');

function fetchProject(db, whereClause, params, callback) {
  db.get(`${PROJECT_SELECT} WHERE ${whereClause}`, params, callback);
}

router.get('/', (req, res) => {
  const db = getDatabase();
  db.all(
    `${PROJECT_SELECT} WHERE p.user_email = ? ORDER BY p.created_at DESC`,
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
  const projectId = parseId(req, res, 'id', 'project ID');
  if (projectId === null) return;

  fetchProject(getDatabase(), 'p.id = ? AND p.user_email = ?', [projectId, req.userEmail], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!row) return res.status(404).json({ error: 'Project not found' });
    res.json({ project: row });
  });
});

router.post('/', (req, res, next) => {
  try {
    const { error, value } = projectSchema.validate(req.body);
    if (error) return next(error);

    const { name, description, clientId, startDate, status } = value;
    const db = getDatabase();

    const insertProject = () => {
      db.run(
        'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || null, clientId || null, startDate || null, status, req.userEmail],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to create project' });
          }
          fetchProject(db, 'p.id = ?', [this.lastID], (err, row) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Project created but failed to retrieve' });
            }
            res.status(201).json({ message: 'Project created successfully', project: row });
          });
        }
      );
    };

    if (clientId) {
      verifyClientBelongsToUser(db, clientId, req.userEmail, (err) => {
        if (err) return res.status(err.status).json({ error: err.error });
        insertProject();
      });
    } else {
      insertProject();
    }
  } catch (error) {
    next(error);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const projectId = parseId(req, res, 'id', 'project ID');
    if (projectId === null) return;

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) return next(error);

    const db = getDatabase();

    checkOwnership(db, 'projects', projectId, req.userEmail, 'Project', (err) => {
      if (err) return res.status(err.status).json({ error: err.error });

      const performUpdate = () => {
        const { query, values } = buildProjectUpdate(value, projectId, req.userEmail);

        db.run(query, values, function(updateErr) {
          if (updateErr) {
            console.error('Database error:', updateErr);
            return res.status(500).json({ error: 'Failed to update project' });
          }
          fetchProject(db, 'p.id = ?', [projectId], (fetchErr, row) => {
            if (fetchErr) {
              console.error('Database error:', fetchErr);
              return res.status(500).json({ error: 'Project updated but failed to retrieve' });
            }
            res.json({ message: 'Project updated successfully', project: row });
          });
        });
      };

      if (value.clientId) {
        verifyClientBelongsToUser(db, value.clientId, req.userEmail, (clientErr) => {
          if (clientErr) return res.status(clientErr.status).json({ error: clientErr.error });
          performUpdate();
        });
      } else {
        performUpdate();
      }
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (req, res) => {
  const projectId = parseId(req, res, 'id', 'project ID');
  if (projectId === null) return;

  const db = getDatabase();

  checkOwnership(db, 'projects', projectId, req.userEmail, 'Project', (err) => {
    if (err) return res.status(err.status).json({ error: err.error });

    db.run(
      'DELETE FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail],
      function(deleteErr) {
        if (deleteErr) {
          console.error('Database error:', deleteErr);
          return res.status(500).json({ error: 'Failed to delete project' });
        }
        res.json({ message: 'Project deleted successfully' });
      }
    );
  });
});

module.exports = router;
