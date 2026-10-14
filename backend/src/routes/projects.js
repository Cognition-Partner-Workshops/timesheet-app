const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Get all projects for authenticated user
router.get('/', (req, res) => {
  const db = getDatabase();
  
  db.all(
    `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status, p.created_at, p.updated_at, c.name AS client_name
     FROM projects p
     LEFT JOIN clients c ON p.client_id = c.id
     WHERE p.user_email = ?
     ORDER BY p.name`,
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

// Get specific project
router.get('/:id', (req, res) => {
  const projectId = parseInt(req.params.id);
  
  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }
  
  const db = getDatabase();
  
  db.get(
    `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status, p.created_at, p.updated_at, c.name AS client_name
     FROM projects p
     LEFT JOIN clients c ON p.client_id = c.id
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

// Create new project
router.post('/', (req, res, next) => {
  try {
    const { error, value } = projectSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { name, description, clientId, startDate, status } = value;
    const db = getDatabase();

    db.run(
      'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, clientId || null, startDate || null, status || 'active', req.userEmail],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to create project' });
        }

        db.get(
          `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status, p.created_at, p.updated_at, c.name AS client_name
           FROM projects p
           LEFT JOIN clients c ON p.client_id = c.id
           WHERE p.id = ?`,
          [this.lastID],
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
          values.push(value.clientId || null);
        }

        if (value.startDate !== undefined) {
          updates.push('start_date = ?');
          values.push(value.startDate || null);
        }

        if (value.status !== undefined) {
          updates.push('status = ?');
          values.push(value.status);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(projectId, req.userEmail);

        const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

        db.run(query, values, function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to update project' });
          }

          db.get(
            `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status, p.created_at, p.updated_at, c.name AS client_name
             FROM projects p
             LEFT JOIN clients c ON p.client_id = c.id
             WHERE p.id = ?`,
            [projectId],
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
        });
      }
    );
  } catch (error) {
    next(error);
  }
});

// Delete all projects for authenticated user
router.delete('/', (req, res) => {
  const db = getDatabase();
  
  db.run(
    'DELETE FROM projects WHERE user_email = ?',
    [req.userEmail],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to delete projects' });
      }
      
      res.json({ 
        message: 'All projects deleted successfully',
        deletedCount: this.changes
      });
    }
  );
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
