const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_COLUMNS = `p.id, p.name, p.description, p.client_id, p.start_date, p.end_date,
       p.status, p.budget_hours, p.created_at, p.updated_at, c.name as client_name`;
const PROJECT_JOIN = `FROM projects p JOIN clients c ON p.client_id = c.id`;

function fetchProjectById(db, projectId, callback) {
  db.get(`SELECT ${PROJECT_COLUMNS} ${PROJECT_JOIN} WHERE p.id = ?`, [projectId], callback);
}

function verifyOwnership(db, table, id, userEmail, callback) {
  db.get(`SELECT id FROM ${table} WHERE id = ? AND user_email = ?`, [id, userEmail], callback);
}

function parseId(raw, label) {
  const id = parseInt(raw);
  if (isNaN(id)) return { error: `Invalid ${label} ID` };
  return { id };
}

function toDateStr(val) {
  if (!val) return null;
  return val instanceof Date ? val.toISOString().split('T')[0] : val;
}

function dbError(res, message) {
  return (err) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: message || 'Internal server error' });
      return true;
    }
    return false;
  };
}

// List projects (optional ?clientId filter)
router.get('/', (req, res) => {
  const { clientId } = req.query;
  const db = getDatabase();

  let query = `SELECT ${PROJECT_COLUMNS} ${PROJECT_JOIN} WHERE p.user_email = ?`;
  const params = [req.userEmail];

  if (clientId) {
    const parsed = parseId(clientId, 'client');
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    query += ' AND p.client_id = ?';
    params.push(parsed.id);
  }

  db.all(query + ' ORDER BY p.created_at DESC', params, (err, rows) => {
    if (dbError(res, 'Internal server error')(err)) return;
    res.json({ projects: rows });
  });
});

// Get single project
router.get('/:id', (req, res) => {
  const parsed = parseId(req.params.id, 'project');
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const db = getDatabase();
  db.get(
    `SELECT ${PROJECT_COLUMNS} ${PROJECT_JOIN} WHERE p.id = ? AND p.user_email = ?`,
    [parsed.id, req.userEmail],
    (err, row) => {
      if (dbError(res, 'Internal server error')(err)) return;
      if (!row) return res.status(404).json({ error: 'Project not found' });
      res.json({ project: row });
    }
  );
});

// Create project
router.post('/', (req, res, next) => {
  try {
    const { error, value } = projectSchema.validate(req.body);
    if (error) return next(error);

    const { name, description, clientId, startDate, endDate, status, budgetHours } = value;
    const db = getDatabase();

    verifyOwnership(db, 'clients', clientId, req.userEmail, (err, row) => {
      if (dbError(res, 'Internal server error')(err)) return;
      if (!row) return res.status(400).json({ error: 'Client not found or does not belong to user' });

      const insertParams = [name, description || null, clientId, toDateStr(startDate),
        toDateStr(endDate), status || 'active', budgetHours || null, req.userEmail];

      db.run(
        `INSERT INTO projects (name, description, client_id, start_date, end_date, status, budget_hours, user_email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        insertParams,
        function(err) {
          if (dbError(res, 'Failed to create project')(err)) return;
          fetchProjectById(db, this.lastID, (err, row) => {
            if (dbError(res, 'Project created but failed to retrieve')(err)) return;
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
    const parsed = parseId(req.params.id, 'project');
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) return next(error);

    const db = getDatabase();

    verifyOwnership(db, 'projects', parsed.id, req.userEmail, (err, row) => {
      if (dbError(res, 'Internal server error')(err)) return;
      if (!row) return res.status(404).json({ error: 'Project not found' });

      const applyUpdate = () => {
        const fieldMap = {
          name: 'name', description: 'description', clientId: 'client_id',
          startDate: 'start_date', endDate: 'end_date', status: 'status', budgetHours: 'budget_hours'
        };
        const updates = [];
        const values = [];
        for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
          if (value[jsKey] !== undefined) {
            updates.push(`${dbCol} = ?`);
            const v = (jsKey === 'startDate' || jsKey === 'endDate') ? toDateStr(value[jsKey]) : (value[jsKey] || null);
            values.push(v);
          }
        }
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(parsed.id, req.userEmail);

        db.run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`, values, function(err) {
          if (dbError(res, 'Failed to update project')(err)) return;
          fetchProjectById(db, parsed.id, (err, row) => {
            if (dbError(res, 'Project updated but failed to retrieve')(err)) return;
            res.json({ message: 'Project updated successfully', project: row });
          });
        });
      };

      if (value.clientId) {
        verifyOwnership(db, 'clients', value.clientId, req.userEmail, (err, clientRow) => {
          if (dbError(res, 'Internal server error')(err)) return;
          if (!clientRow) return res.status(400).json({ error: 'Client not found or does not belong to user' });
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

// Delete project
router.delete('/:id', (req, res) => {
  const parsed = parseId(req.params.id, 'project');
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const db = getDatabase();

  verifyOwnership(db, 'projects', parsed.id, req.userEmail, (err, row) => {
    if (dbError(res, 'Internal server error')(err)) return;
    if (!row) return res.status(404).json({ error: 'Project not found' });

    db.run('DELETE FROM projects WHERE id = ? AND user_email = ?', [parsed.id, req.userEmail], function(err) {
      if (dbError(res, 'Failed to delete project')(err)) return;
      res.json({ message: 'Project deleted successfully' });
    });
  });
});

module.exports = router;
