const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { clientSchema, updateClientSchema } = require('../validation/schemas');
const { parseId, sendDbError, buildUpdateClause } = require('../utils/routeHelpers');
const { CLIENT_COLUMNS } = require('../database/queries');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Get all clients for authenticated user
router.get('/', (req, res) => {
  const db = getDatabase();
  
  db.all(
    `SELECT ${CLIENT_COLUMNS} FROM clients WHERE user_email = ? ORDER BY name`,
    [req.userEmail],
    (err, rows) => {
      if (err) {
        return sendDbError(res, err);
      }
      
      res.json({ clients: rows });
    }
  );
});

// Get specific client
router.get('/:id', (req, res) => {
  const clientId = parseId(req.params.id);
  
  if (clientId === null) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  const db = getDatabase();
  
  db.get(
    `SELECT ${CLIENT_COLUMNS} FROM clients WHERE id = ? AND user_email = ?`,
    [clientId, req.userEmail],
    (err, row) => {
      if (err) {
        return sendDbError(res, err);
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      res.json({ client: row });
    }
  );
});

// Create new client
router.post('/', (req, res, next) => {
  try {
    const { error, value } = clientSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { name, description, department, email } = value;
    const db = getDatabase();

    db.run(
      'INSERT INTO clients (name, description, department, email, user_email) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, department || null, email || null, req.userEmail],
      function(err) {
        if (err) {
          return sendDbError(res, err, 'Failed to create client');
        }

        // Return the created client
        db.get(
          `SELECT ${CLIENT_COLUMNS} FROM clients WHERE id = ?`,
          [this.lastID],
          (err, row) => {
            if (err) {
              return sendDbError(res, err, 'Client created but failed to retrieve');
            }

            res.status(201).json({ 
              message: 'Client created successfully',
              client: row 
            });
          }
        );
      }
    );
  } catch (error) {
    next(error);
  }
});

// Update client
router.put('/:id', (req, res, next) => {
  try {
    const clientId = parseId(req.params.id);
    
    if (clientId === null) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const { error, value } = updateClientSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const db = getDatabase();

    // Check if client exists and belongs to user
    db.get(
      'SELECT id FROM clients WHERE id = ? AND user_email = ?',
      [clientId, req.userEmail],
      (err, row) => {
        if (err) {
          return sendDbError(res, err);
        }

        if (!row) {
          return res.status(404).json({ error: 'Client not found' });
        }

        // Build update query dynamically
        const { setClause, params } = buildUpdateClause([
          { column: 'name', value: value.name, include: value.name !== undefined },
          { column: 'description', value: value.description || null, include: value.description !== undefined },
          { column: 'department', value: value.department || null, include: value.department !== undefined },
          { column: 'email', value: value.email || null, include: value.email !== undefined }
        ]);
        params.push(clientId, req.userEmail);

        const query = `UPDATE clients SET ${setClause} WHERE id = ? AND user_email = ?`;

        db.run(query, params, function(err) {
          if (err) {
            return sendDbError(res, err, 'Failed to update client');
          }

          // Return updated client
          db.get(
            `SELECT ${CLIENT_COLUMNS} FROM clients WHERE id = ?`,
            [clientId],
            (err, row) => {
              if (err) {
                return sendDbError(res, err, 'Client updated but failed to retrieve');
              }

              res.json({
                message: 'Client updated successfully',
                client: row
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

// Delete all clients for authenticated user
router.delete('/', (req, res) => {
  const db = getDatabase();
  
  db.run(
    'DELETE FROM clients WHERE user_email = ?',
    [req.userEmail],
    function(err) {
      if (err) {
        return sendDbError(res, err, 'Failed to delete clients');
      }
      
      res.json({ 
        message: 'All clients deleted successfully',
        deletedCount: this.changes
      });
    }
  );
});

// Delete client
router.delete('/:id', (req, res) => {
  const clientId = parseId(req.params.id);
  
  if (clientId === null) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  const db = getDatabase();
  
  // Check if client exists and belongs to user
  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, row) => {
      if (err) {
        return sendDbError(res, err);
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      // Delete client (work entries will be deleted due to CASCADE)
      db.run(
        'DELETE FROM clients WHERE id = ? AND user_email = ?',
        [clientId, req.userEmail],
        function(err) {
          if (err) {
            return sendDbError(res, err, 'Failed to delete client');
          }
          
          res.json({ message: 'Client deleted successfully' });
        }
      );
    }
  );
});

module.exports = router;
