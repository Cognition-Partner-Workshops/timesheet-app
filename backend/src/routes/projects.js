const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const {
  PROJECT_STATUSES,
  projectSchema,
  updateProjectSchema
} = require('../validation/schemas');

const router = express.Router();
const projectSelect = `
  p.id, p.name, p.description, p.client_id, p.start_date, p.status,
  p.created_at, p.updated_at, c.name as client_name
`;

router.use(authenticateUser);

router.get('/', (req, res) => {
  const db = getDatabase();
  let query = `
    SELECT ${projectSelect}
    FROM projects p
    JOIN clients c ON p.client_id = c.id
    WHERE p.user_email = ?
  `;
  const params = [req.userEmail];

  if (req.query.clientId !== undefined) {
    const clientId = parseInt(req.query.clientId);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    query += ' AND p.client_id = ?';
    params.push(clientId);
  }

  if (req.query.status !== undefined) {
    if (!PROJECT_STATUSES.includes(req.query.status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    query += ' AND p.status = ?';
    params.push(req.query.status);
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

router.get('/:id', (req, res) => {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const db = getDatabase();
  db.get(
    `SELECT ${projectSelect}
     FROM projects p
     JOIN clients c ON p.client_id = c.id
     WHERE p.id = ? AND p.user_email = ?`,
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

router.post('/', (req, res, next) => {
  try {
    const { error, value } = projectSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { name, description, clientId, startDate, status } = value;
    const db = getDatabase();

    db.get(
      'SELECT id FROM clients WHERE id = ? AND user_email = ?',
      [clientId, req.userEmail],
      (err, client) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (!client) {
          return res.status(400).json({ error: 'Client not found or does not belong to user' });
        }

        db.run(
          `INSERT INTO projects (name, description, client_id, start_date, status, user_email)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [name, description || null, clientId, startDate, status, req.userEmail],
          function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to create project' });
            }

            db.get(
              `SELECT ${projectSelect}
               FROM projects p
               JOIN clients c ON p.client_id = c.id
               WHERE p.id = ? AND p.user_email = ?`,
              [this.lastID, req.userEmail],
              (err, row) => {
                if (err) {
                  console.error('Database error:', err);
                  return res.status(500).json({ error: 'Project created but failed to retrieve' });
                }

                res.status(201).json({
                  message: 'Project created successfully',
                  project: row
                });
              }
            );
          }
        );
      }
    );
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
    if (error) {
      return next(error);
    }

    const db = getDatabase();
    db.get(
      'SELECT id FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail],
      (err, project) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        if (value.clientId !== undefined) {
          db.get(
            'SELECT id FROM clients WHERE id = ? AND user_email = ?',
            [value.clientId, req.userEmail],
            (err, client) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
              }

              if (!client) {
                return res.status(400).json({ error: 'Client not found or does not belong to user' });
              }

              performUpdate();
            }
          );
        } else {
          performUpdate();
        }

        function performUpdate() {
          const updates = [];
          const values = [];

          if (value.name !== undefined) {
            updates.push('name = ?');
            values.push(value.name);
          }

          if (value.description !== undefined) {
            updates.push('description = ?');
            values.push(value.description || null);
          }

          if (value.clientId !== undefined) {
            updates.push('client_id = ?');
            values.push(value.clientId);
          }

          if (value.startDate !== undefined) {
            updates.push('start_date = ?');
            values.push(value.startDate);
          }

          if (value.status !== undefined) {
            updates.push('status = ?');
            values.push(value.status);
          }

          updates.push('updated_at = CURRENT_TIMESTAMP');
          values.push(projectId, req.userEmail);

          db.run(
            `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`,
            values,
            (err) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to update project' });
              }

              db.get(
                `SELECT ${projectSelect}
                 FROM projects p
                 JOIN clients c ON p.client_id = c.id
                 WHERE p.id = ? AND p.user_email = ?`,
                [projectId, req.userEmail],
                (err, row) => {
                  if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Project updated but failed to retrieve' });
                  }

                  res.json({
                    message: 'Project updated successfully',
                    project: row
                  });
                }
              );
            }
          );
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
    (err, project) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      db.run(
        'DELETE FROM projects WHERE id = ? AND user_email = ?',
        [projectId, req.userEmail],
        (err) => {
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
