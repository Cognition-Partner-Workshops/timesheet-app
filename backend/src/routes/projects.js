const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_SELECT = `
  SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.end_date,
         p.status, p.budget_hours, p.created_at, p.updated_at, c.name as client_name
  FROM projects p
  JOIN clients c ON p.client_id = c.id`;

function fetchProjectById(db, projectId, callback) {
  db.get(`${PROJECT_SELECT} WHERE p.id = ?`, [projectId], callback);
}

function verifyClientOwnership(db, clientId, userEmail, callback) {
  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, userEmail],
    callback
  );
}

const FIELD_MAP = {
  name: 'name',
  description: 'description',
  clientId: 'client_id',
  startDate: 'start_date',
  endDate: 'end_date',
  status: 'status',
  budgetHours: 'budget_hours'
};

const NULLABLE_FIELDS = new Set(['description', 'startDate', 'endDate', 'budgetHours']);

function buildUpdateParams(value) {
  const updates = [];
  const values = [];
  for (const [jsKey, dbCol] of Object.entries(FIELD_MAP)) {
    if (value[jsKey] !== undefined) {
      updates.push(`${dbCol} = ?`);
      values.push(NULLABLE_FIELDS.has(jsKey) ? (value[jsKey] || null) : value[jsKey]);
    }
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  return { updates, values };
}

// Get all projects for authenticated user (with optional clientId filter)
router.get('/', (req, res) => {
  const { clientId } = req.query;
  const db = getDatabase();

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

  query += ' ORDER BY p.name';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json({ projects: rows });
  });
});

// Get specific project
router.get('/:id', (req, res) => {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const db = getDatabase();
  db.get(
    `${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`,
    [projectId, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json({ project: row });
    }
  );
});

// Create new project
router.post('/', (req, res, next) => {
  try {
    const { error, value } = projectSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { name, description, clientId, startDate, endDate, status, budgetHours } = value;
    const db = getDatabase();

    verifyClientOwnership(db, clientId, req.userEmail, (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!row) {
        return res.status(400).json({ error: 'Client not found or does not belong to user' });
      }

      db.run(
        `INSERT INTO projects (name, description, client_id, start_date, end_date, status, budget_hours, user_email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, description || null, clientId, startDate || null, endDate || null,
         status || 'active', budgetHours || null, req.userEmail],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to create project' });
          }
          fetchProjectById(db, this.lastID, (err, row) => {
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

// Update project
router.put('/:id', (req, res, next) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) {
      return next(error);
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

        if (value.clientId) {
          verifyClientOwnership(db, value.clientId, req.userEmail, (err, clientRow) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }
            if (!clientRow) {
              return res.status(400).json({ error: 'Client not found or does not belong to user' });
            }
            performUpdate();
          });
        } else {
          performUpdate();
        }

        function performUpdate() {
          const { updates, values } = buildUpdateParams(value);
          values.push(projectId, req.userEmail);

          db.run(
            `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`,
            values,
            function(err) {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to update project' });
              }
              fetchProjectById(db, projectId, (err, row) => {
                if (err) {
                  console.error('Database error:', err);
                  return res.status(500).json({ error: 'Project updated but failed to retrieve' });
                }
                res.json({ message: 'Project updated successfully', project: row });
              });
            }
          );
        }
      }
    );
  } catch (error) {
    next(error);
  }
});

// Delete project
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
