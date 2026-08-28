const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

const PROJECT_SELECT_FIELDS = `p.id, p.name, p.description, p.client_id, p.start_date, p.end_date, p.status, p.created_at, p.updated_at, c.name as client_name`;

// Check for overlapping project dates for the same client
function checkDateOverlap(db, clientId, startDate, endDate, userEmail, excludeProjectId, callback) {
  if (!clientId || (!startDate && !endDate)) {
    return callback(null, false);
  }

  let query = `
    SELECT id, name, start_date, end_date FROM projects
    WHERE client_id = ? AND user_email = ?
  `;
  const params = [clientId, userEmail];

  if (excludeProjectId) {
    query += ' AND id != ?';
    params.push(excludeProjectId);
  }

  db.all(query, params, (err, existingProjects) => {
    if (err) {
      return callback(err, false);
    }

    for (const existing of existingProjects) {
      if (!existing.start_date && !existing.end_date) {
        continue;
      }

      const newStart = startDate ? new Date(startDate) : null;
      const newEnd = endDate ? new Date(endDate) : null;
      const existStart = existing.start_date ? new Date(existing.start_date) : null;
      const existEnd = existing.end_date ? new Date(existing.end_date) : null;

      // Ranges overlap when both starts are before the other's end
      // Null end means open-ended (infinite future), null start means open-ended (infinite past)
      const newStartBeforeExistEnd = !newStart || !existEnd || newStart <= existEnd;
      const existStartBeforeNewEnd = !existStart || !newEnd || existStart <= newEnd;

      if (newStartBeforeExistEnd && existStartBeforeNewEnd) {
        return callback(null, true, existing);
      }
    }

    callback(null, false);
  });
}

// Get all projects for authenticated user
router.get('/', (req, res) => {
  const db = getDatabase();
  
  db.all(
    `SELECT ${PROJECT_SELECT_FIELDS}
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
    `SELECT ${PROJECT_SELECT_FIELDS}
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

    const { name, description, clientId, startDate, endDate, status } = value;
    const db = getDatabase();

    // If clientId is provided, verify client exists and belongs to user
    if (clientId) {
      db.get(
        'SELECT id FROM clients WHERE id = ? AND user_email = ?',
        [clientId, req.userEmail],
        (err, clientRow) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }

          if (!clientRow) {
            return res.status(400).json({ error: 'Client not found' });
          }

          // Check for date overlap with other projects for same client
          checkDateOverlap(db, clientId, startDate, endDate, req.userEmail, null, (err, overlaps, overlappingProject) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }

            if (overlaps) {
              return res.status(400).json({
                error: `Project dates overlap with existing project "${overlappingProject.name}" for the same client`
              });
            }

            insertProject(db, name, description, clientId, startDate, endDate, status, req.userEmail, res);
          });
        }
      );
    } else {
      insertProject(db, name, description, null, startDate, endDate, status, req.userEmail, res);
    }
  } catch (error) {
    next(error);
  }
});

function insertProject(db, name, description, clientId, startDate, endDate, status, userEmail, res) {
  db.run(
    'INSERT INTO projects (name, description, client_id, start_date, end_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, description || null, clientId, startDate || null, endDate || null, status, userEmail],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to create project' });
      }

      // Return the created project
      db.get(
        `SELECT ${PROJECT_SELECT_FIELDS}
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
}

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

    // Check if project exists and belongs to user
    db.get(
      'SELECT id, client_id, start_date, end_date FROM projects WHERE id = ? AND user_email = ?',
      [projectId, req.userEmail],
      (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (!row) {
          return res.status(404).json({ error: 'Project not found' });
        }

        // Determine effective values for overlap check
        const effectiveClientId = value.clientId !== undefined ? value.clientId : row.client_id;
        const effectiveStartDate = value.startDate !== undefined ? value.startDate : row.start_date;
        const effectiveEndDate = value.endDate !== undefined ? value.endDate : row.end_date;

        // Validate end date >= start date when updating only one of them
        if (effectiveStartDate && effectiveEndDate && new Date(effectiveEndDate) < new Date(effectiveStartDate)) {
          return res.status(400).json({ error: 'End date must not be before start date' });
        }

        // If clientId is being updated, verify new client exists
        if (value.clientId !== undefined && value.clientId !== null) {
          db.get(
            'SELECT id FROM clients WHERE id = ? AND user_email = ?',
            [value.clientId, req.userEmail],
            (err, clientRow) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
              }

              if (!clientRow) {
                return res.status(400).json({ error: 'Client not found' });
              }

              // Check date overlap
              checkDateOverlap(db, effectiveClientId, effectiveStartDate, effectiveEndDate, req.userEmail, projectId, (err, overlaps, overlappingProject) => {
                if (err) {
                  console.error('Database error:', err);
                  return res.status(500).json({ error: 'Internal server error' });
                }

                if (overlaps) {
                  return res.status(400).json({
                    error: `Project dates overlap with existing project "${overlappingProject.name}" for the same client`
                  });
                }

                performUpdate(db, projectId, value, req.userEmail, res);
              });
            }
          );
        } else if (effectiveClientId && (value.startDate !== undefined || value.endDate !== undefined)) {
          // Dates changed but client didn't - still need overlap check
          checkDateOverlap(db, effectiveClientId, effectiveStartDate, effectiveEndDate, req.userEmail, projectId, (err, overlaps, overlappingProject) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }

            if (overlaps) {
              return res.status(400).json({
                error: `Project dates overlap with existing project "${overlappingProject.name}" for the same client`
              });
            }

            performUpdate(db, projectId, value, req.userEmail, res);
          });
        } else {
          performUpdate(db, projectId, value, req.userEmail, res);
        }
      }
    );
  } catch (error) {
    next(error);
  }
});

function performUpdate(db, projectId, value, userEmail, res) {
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

  if (value.clientId !== undefined) {
    updates.push('client_id = ?');
    values.push(value.clientId);
  }

  if (value.startDate !== undefined) {
    updates.push('start_date = ?');
    values.push(value.startDate || null);
  }

  if (value.endDate !== undefined) {
    updates.push('end_date = ?');
    values.push(value.endDate || null);
  }

  if (value.status !== undefined) {
    updates.push('status = ?');
    values.push(value.status);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(projectId, userEmail);

  const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

  db.run(query, values, function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to update project' });
    }

    // Return updated project
    db.get(
      `SELECT ${PROJECT_SELECT_FIELDS}
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
