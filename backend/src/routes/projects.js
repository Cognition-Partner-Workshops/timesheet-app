const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Helper: check for date overlap with existing projects
// Two date ranges [s1, e1] and [s2, e2] overlap when s1 <= e2 AND s2 <= e1
function checkDateOverlap(db, userEmail, startDate, endDate, excludeId, callback) {
  if (!startDate || !endDate) {
    return callback(null, false);
  }

  const query = excludeId
    ? `SELECT id, name FROM projects
       WHERE user_email = ? AND id != ?
         AND start_date IS NOT NULL AND end_date IS NOT NULL
         AND start_date <= ? AND end_date >= ?`
    : `SELECT id, name FROM projects
       WHERE user_email = ?
         AND start_date IS NOT NULL AND end_date IS NOT NULL
         AND start_date <= ? AND end_date >= ?`;

  const params = excludeId
    ? [userEmail, excludeId, endDate, startDate]
    : [userEmail, endDate, startDate];

  db.get(query, params, (err, row) => {
    if (err) {
      return callback(err, null);
    }
    callback(null, row || false);
  });
}

// Get all projects for authenticated user
router.get('/', (req, res) => {
  const db = getDatabase();
  
  db.all(
    `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.end_date, p.status, p.created_at, p.updated_at, c.name as client_name
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
    `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.end_date, p.status, p.created_at, p.updated_at, c.name as client_name
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

    const { name, description, client_id, start_date, end_date, status } = value;

    // Validate end_date >= start_date
    if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ error: 'End date must not be before start date' });
    }

    const db = getDatabase();

    // Check for date overlap
    checkDateOverlap(db, req.userEmail, start_date, end_date, null, (err, overlap) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (overlap) {
        return res.status(409).json({ error: `Project dates overlap with existing project "${overlap.name}"` });
      }

      db.run(
        'INSERT INTO projects (name, description, client_id, start_date, end_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, description || null, client_id || null, start_date || null, end_date || null, status, req.userEmail],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to create project' });
          }

          // Return the created project
          db.get(
            `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.end_date, p.status, p.created_at, p.updated_at, c.name as client_name
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

    // Check if project exists and belongs to user — fetch current dates for overlap check
    db.get(
      'SELECT id, start_date, end_date FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail],
      (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (!row) {
          return res.status(404).json({ error: 'Project not found' });
        }

        // Merge existing dates with incoming values for overlap check
        const effectiveStartDate = value.start_date !== undefined ? (value.start_date || null) : row.start_date;
        const effectiveEndDate = value.end_date !== undefined ? (value.end_date || null) : row.end_date;

        // Validate end_date >= start_date
        if (effectiveStartDate && effectiveEndDate && new Date(effectiveEndDate) < new Date(effectiveStartDate)) {
          return res.status(400).json({ error: 'End date must not be before start date' });
        }

        // Check for date overlap (excluding current project)
        checkDateOverlap(db, req.userEmail, effectiveStartDate, effectiveEndDate, projectId, (err, overlap) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }

          if (overlap) {
            return res.status(409).json({ error: `Project dates overlap with existing project "${overlap.name}"` });
          }

          // Build update query dynamically
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

          if (value.client_id !== undefined) {
            updates.push('client_id = ?');
            values.push(value.client_id || null);
          }

          if (value.start_date !== undefined) {
            updates.push('start_date = ?');
            values.push(value.start_date || null);
          }

          if (value.end_date !== undefined) {
            updates.push('end_date = ?');
            values.push(value.end_date || null);
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

            // Return updated project
            db.get(
              `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.end_date, p.status, p.created_at, p.updated_at, c.name as client_name
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
  
  // Check if project exists and belongs to user
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
      
      // Delete project
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
