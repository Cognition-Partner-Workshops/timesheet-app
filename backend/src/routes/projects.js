const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all projects for authenticated user
router.get('/', (req, res) => {
  const db = getDatabase();
  
  db.all(
    `SELECT p.*, c.name as client_name 
     FROM projects p 
     LEFT JOIN clients c ON p.client_id = c.id 
     WHERE p.user_email = ? 
     ORDER BY p.created_at DESC`,
    [req.userEmail],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch projects' });
      }
      res.json({ projects: rows || [] });
    }
  );
});

// Get single project by ID
router.get('/:id', (req, res) => {
  const db = getDatabase();
  
  db.get(
    `SELECT p.*, c.name as client_name 
     FROM projects p 
     LEFT JOIN clients c ON p.client_id = c.id 
     WHERE p.id = ? AND p.user_email = ?`,
    [req.params.id, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch project' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json({ project: row });
    }
  );
});

// Create a new project
router.post('/', (req, res, next) => {
  const { error, value } = projectSchema.validate(req.body);
  if (error) {
    return next(error);
  }

  const db = getDatabase();
  const { name, description, clientId, status } = value;

  // Verify client belongs to user
  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, client) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to verify client' });
      }
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      db.run(
        `INSERT INTO projects (name, description, client_id, status, user_email) 
         VALUES (?, ?, ?, ?, ?)`,
        [name, description || '', clientId, status || 'active', req.userEmail],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to create project' });
          }

          db.get(
            `SELECT p.*, c.name as client_name 
             FROM projects p 
             LEFT JOIN clients c ON p.client_id = c.id 
             WHERE p.id = ?`,
            [this.lastID],
            (err, row) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to fetch created project' });
              }
              res.status(201).json({ project: row });
            }
          );
        }
      );
    }
  );
});

// Update a project
router.put('/:id', (req, res, next) => {
  const { error, value } = updateProjectSchema.validate(req.body);
  if (error) {
    return next(error);
  }

  const db = getDatabase();

  // Verify project belongs to user
  db.get(
    'SELECT id FROM projects WHERE id = ? AND user_email = ?',
    [req.params.id, req.userEmail],
    (err, project) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to verify project' });
      }
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // If clientId is being updated, verify the new client belongs to user
      const updateFields = [];
      const updateValues = [];

      if (value.name !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(value.name);
      }
      if (value.description !== undefined) {
        updateFields.push('description = ?');
        updateValues.push(value.description);
      }
      if (value.status !== undefined) {
        updateFields.push('status = ?');
        updateValues.push(value.status);
      }

      const doUpdate = (clientId) => {
        if (clientId !== undefined) {
          updateFields.push('client_id = ?');
          updateValues.push(clientId);
        }
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(req.params.id, req.userEmail);

        db.run(
          `UPDATE projects SET ${updateFields.join(', ')} WHERE id = ? AND user_email = ?`,
          updateValues,
          function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to update project' });
            }

            db.get(
              `SELECT p.*, c.name as client_name 
               FROM projects p 
               LEFT JOIN clients c ON p.client_id = c.id 
               WHERE p.id = ?`,
              [req.params.id],
              (err, row) => {
                if (err) {
                  console.error('Database error:', err);
                  return res.status(500).json({ error: 'Failed to fetch updated project' });
                }
                res.json({ project: row });
              }
            );
          }
        );
      };

      if (value.clientId !== undefined) {
        db.get(
          'SELECT id FROM clients WHERE id = ? AND user_email = ?',
          [value.clientId, req.userEmail],
          (err, client) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to verify client' });
            }
            if (!client) {
              return res.status(404).json({ error: 'Client not found' });
            }
            doUpdate(value.clientId);
          }
        );
      } else {
        doUpdate();
      }
    }
  );
});

// Delete a project
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  
  db.run(
    'DELETE FROM projects WHERE id = ? AND user_email = ?',
    [req.params.id, req.userEmail],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to delete project' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json({ message: 'Project deleted successfully' });
    }
  );
});

module.exports = router;
