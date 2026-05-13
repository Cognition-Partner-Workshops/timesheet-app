const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_SELECT = `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status,
       p.created_at, p.updated_at, c.name as client_name
FROM projects p
JOIN clients c ON p.client_id = c.id`;

const FIELD_MAP = {
  name: 'name',
  description: 'description',
  clientId: 'client_id',
  startDate: 'start_date',
  status: 'status'
};

function verifyClientOwnership(db, clientId, userEmail, callback) {
  db.get('SELECT id FROM clients WHERE id = ? AND user_email = ?', [clientId, userEmail], (err, row) => {
    if (err) return callback(err);
    callback(null, !!row);
  });
}

function buildDynamicUpdate(value) {
  const updates = [];
  const values = [];
  for (const [jsKey, dbCol] of Object.entries(FIELD_MAP)) {
    if (value[jsKey] === undefined) continue;
    updates.push(`${dbCol} = ?`);
    values.push(jsKey === 'description' ? (value[jsKey] || null) : value[jsKey]);
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  return { setClauses: updates.join(', '), values };
}

function fetchProject(db, condition, params, callback) {
  db.get(`${PROJECT_SELECT} WHERE ${condition}`, params, callback);
}

function handleDbError(res, msg) {
  return (err) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: msg });
      return true;
    }
    return false;
  };
}

function parseIdParam(req, res, label) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: `Invalid ${label} ID` });
    return null;
  }
  return id;
}

function findOwnedRecord(db, table, id, userEmail, notFoundMsg, callback) {
  db.get(`SELECT id FROM ${table} WHERE id = ? AND user_email = ?`, [id, userEmail], (err, row) => {
    if (err) return callback(err);
    if (!row) return callback(null, null);
    callback(null, row);
  });
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
  const projectId = parseIdParam(req, res, 'project');
  if (!projectId) return;

  fetchProject(getDatabase(), 'p.id = ? AND p.user_email = ?', [projectId, req.userEmail], (err, row) => {
    if (handleDbError(res, 'Internal server error')(err)) return;
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

    verifyClientOwnership(db, clientId, req.userEmail, (err, owned) => {
      if (handleDbError(res, 'Internal server error')(err)) return;
      if (!owned) return res.status(400).json({ error: 'Client not found or does not belong to user' });

      db.run(
        'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || null, clientId, startDate, status, req.userEmail],
        function(insertErr) {
          if (handleDbError(res, 'Failed to create project')(insertErr)) return;
          fetchProject(db, 'p.id = ?', [this.lastID], (fetchErr, row) => {
            if (handleDbError(res, 'Project created but failed to retrieve')(fetchErr)) return;
            res.status(201).json({ message: 'Project created successfully', project: row });
          });
        }
      );
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const projectId = parseIdParam(req, res, 'project');
    if (!projectId) return;

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) return next(error);

    const db = getDatabase();

    findOwnedRecord(db, 'projects', projectId, req.userEmail, 'Project not found', (err, row) => {
      if (handleDbError(res, 'Internal server error')(err)) return;
      if (!row) return res.status(404).json({ error: 'Project not found' });

      const applyUpdate = () => {
        const { setClauses, values } = buildDynamicUpdate(value);
        values.push(projectId, req.userEmail);

        db.run(`UPDATE projects SET ${setClauses} WHERE id = ? AND user_email = ?`, values, function(updateErr) {
          if (handleDbError(res, 'Failed to update project')(updateErr)) return;
          fetchProject(db, 'p.id = ?', [projectId], (fetchErr, updated) => {
            if (handleDbError(res, 'Project updated but failed to retrieve')(fetchErr)) return;
            res.json({ message: 'Project updated successfully', project: updated });
          });
        });
      };

      if (value.clientId) {
        verifyClientOwnership(db, value.clientId, req.userEmail, (clientErr, owned) => {
          if (handleDbError(res, 'Internal server error')(clientErr)) return;
          if (!owned) return res.status(400).json({ error: 'Client not found or does not belong to user' });
          applyUpdate();
        });
      } else {
        applyUpdate();
      }
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (req, res) => {
  const projectId = parseIdParam(req, res, 'project');
  if (!projectId) return;

  const db = getDatabase();

  findOwnedRecord(db, 'projects', projectId, req.userEmail, 'Project not found', (err, row) => {
    if (handleDbError(res, 'Internal server error')(err)) return;
    if (!row) return res.status(404).json({ error: 'Project not found' });

    db.run('DELETE FROM projects WHERE id = ? AND user_email = ?', [projectId, req.userEmail], function(delErr) {
      if (handleDbError(res, 'Failed to delete project')(delErr)) return;
      res.json({ message: 'Project deleted successfully' });
    });
  });
});

module.exports = router;
