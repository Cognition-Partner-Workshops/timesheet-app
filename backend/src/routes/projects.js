const express = require('express');
const { getDatabase } = require('../database/init');
const { buildUpdateQuery } = require('../database/helpers');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_SELECT = `
  SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.end_date,
         p.status, p.budget_hours, p.created_at, p.updated_at,
         c.name as client_name
  FROM projects p
  JOIN clients c ON p.client_id = c.id`;

const VALID_STATUSES = ['active', 'completed', 'on-hold'];

function getProjectById(db, projectId, callback) {
  db.get(`${PROJECT_SELECT} WHERE p.id = ?`, [projectId], callback);
}

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

// Get all projects for authenticated user (with optional filters)
router.get('/', (req, res) => {
  const { status, clientId } = req.query;
  const db = getDatabase();

  let query = `${PROJECT_SELECT} WHERE p.user_email = ?`;
  const params = [req.userEmail];

  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status filter. Must be: active, completed, or on-hold' });
    }
    query += ' AND p.status = ?';
    params.push(status);
  }

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
    if (error) return next(error);

    const { name, description, clientId, startDate, endDate, status, budgetHours } = value;
    const db = getDatabase();

    verifyClientOwnership(db, clientId, req.userEmail, (err, valid) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!valid) {
        return res.status(400).json({ error: 'Client not found or does not belong to user' });
      }

      db.run(
        `INSERT INTO projects (name, description, client_id, user_email, start_date, end_date, status, budget_hours)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, description || null, clientId, req.userEmail,
         startDate || null, endDate || null, status || 'active',
         budgetHours != null ? budgetHours : null],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to create project' });
          }
          getProjectById(db, this.lastID, (err, row) => {
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

// Field mapping from validated request body to DB columns
const PROJECT_FIELD_MAP = {
  name: { column: 'name' },
  description: { column: 'description', nullable: true },
  clientId: { column: 'client_id' },
  startDate: { column: 'start_date', nullable: true },
  endDate: { column: 'end_date', nullable: true },
  status: { column: 'status' },
  budgetHours: { column: 'budget_hours', nullable: true }
};

function collectUpdateFields(value, fieldMap) {
  const fields = [];
  for (const [key, config] of Object.entries(fieldMap)) {
    if (value[key] !== undefined) {
      const val = config.nullable ? (value[key] != null ? value[key] : null) : value[key];
      fields.push({ column: config.column, value: val });
    }
  }
  return fields;
}

// Update project
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

        const doUpdate = () => {
          const fields = collectUpdateFields(value, PROJECT_FIELD_MAP);
          const { sql, params } = buildUpdateQuery('projects', fields, { id: projectId, userEmail: req.userEmail });

          db.run(sql, params, function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to update project' });
            }
            getProjectById(db, projectId, (err, row) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Project updated but failed to retrieve' });
              }
              res.json({ message: 'Project updated successfully', project: row });
            });
          });
        };

        if (value.clientId !== undefined) {
          verifyClientOwnership(db, value.clientId, req.userEmail, (err, valid) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }
            if (!valid) {
              return res.status(400).json({ error: 'Client not found or does not belong to user' });
            }
            doUpdate();
          });
        } else {
          doUpdate();
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
        'UPDATE work_entries SET project_id = NULL WHERE project_id = ? AND user_email = ?',
        [projectId, req.userEmail],
        (err) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to unlink work entries' });
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
    }
  );
});

module.exports = router;
