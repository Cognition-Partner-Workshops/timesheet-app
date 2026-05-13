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
  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail],
    (err, row) => {
      if (err) return callback(err);
      if (!row) return callback(null, false);
      callback(null, true);
    }
  );
}

function buildDynamicUpdate(value) {
  const updates = [];
  const values = [];
  for (const [jsKey, dbCol] of Object.entries(FIELD_MAP)) {
    if (value[jsKey] !== undefined) {
      updates.push(`${dbCol} = ?`);
      values.push(jsKey === 'description' ? (value[jsKey] || null) : value[jsKey]);
    }
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  return { updates, values };
}

function fetchProject(db, condition, params, callback) {
  db.get(`${PROJECT_SELECT} WHERE ${condition}`, params, callback);
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
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  fetchProject(getDatabase(), 'p.id = ? AND p.user_email = ?', [projectId, req.userEmail], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Project not found' });
    }
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
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!owned) {
        return res.status(400).json({ error: 'Client not found or does not belong to user' });
      }

      db.run(
        'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || null, clientId, startDate, status, req.userEmail],
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
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) return next(error);

    const db = getDatabase();

    db.get(
      'SELECT id FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail],
      (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
        if (!row) {
          return res.status(404).json({ error: 'Project not found' });
        }

        const applyUpdate = () => {
          const { updates, values } = buildDynamicUpdate(value);
          values.push(projectId, req.userEmail);

          db.run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`, values, function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to update project' });
            }
            fetchProject(db, 'p.id = ?', [projectId], (err, row) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Project updated but failed to retrieve' });
              }
              res.json({ message: 'Project updated successfully', project: row });
            });
          });
        };

        if (value.clientId) {
          verifyClientOwnership(db, value.clientId, req.userEmail, (err, owned) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }
            if (!owned) {
              return res.status(400).json({ error: 'Client not found or does not belong to user' });
            }
            applyUpdate();
          });
        } else {
          applyUpdate();
        }
      }
    );
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (req, res) => {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const db = getDatabase();

  db.get(
    'SELECT id FROM projects WHERE id = ? AND user_email = ?',
    [projectId, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Project not found' });
      }

      db.run(
        'DELETE FROM projects WHERE id = ? AND user_email = ?',
        [projectId, req.userEmail],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to delete project' });
          }
          res.json({ message: 'Project deleted successfully' });
        }
      );
    }
  );
});

module.exports = router;
