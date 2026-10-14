const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { clientSchema, updateClientSchema } = require('../validation/schemas');
const { validateIdParam, buildUpdateSet, handleDbError } = require('./helpers');

/** Updatable client columns and their request-body keys. */
const UPDATE_FIELDS = [
  { column: 'name', key: 'name' },
  { column: 'description', key: 'description', nullable: true },
  { column: 'department', key: 'department', nullable: true },
  { column: 'email', key: 'email', nullable: true },
];

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Get all clients for authenticated user
router.get('/', (req, res) => {
  const db = getDatabase();
  
  db.all(
    'SELECT id, name, description, department, email, created_at, updated_at FROM clients WHERE user_email = ? ORDER BY name',
    [req.userEmail],
    (err, rows) => {
      if (err) {
        return handleDbError(res, err);
      }
      
      res.json({ clients: rows });
    }
  );
});

// Get specific client
router.get('/:id', validateIdParam('client'), (req, res) => {
  const clientId = req.parsedId;
  const db = getDatabase();
  
  db.get(
    'SELECT id, name, description, department, email, created_at, updated_at FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, row) => {
      if (err) {
        return handleDbError(res, err);
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
          return handleDbError(res, err, 'Failed to create client');
        }

        // Return the created client
        db.get(
          'SELECT id, name, description, department, email, created_at, updated_at FROM clients WHERE id = ?',
          [this.lastID],
          (err, row) => {
            if (err) {
              return handleDbError(res, err, 'Client created but failed to retrieve');
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
router.put('/:id', validateIdParam('client'), (req, res, next) => {
  try {
    const clientId = req.parsedId;

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
          return handleDbError(res, err);
        }

        if (!row) {
          return res.status(404).json({ error: 'Client not found' });
        }

        const { setClause, values } = buildUpdateSet(UPDATE_FIELDS, value);
        values.push(clientId, req.userEmail);

        const query = `UPDATE clients SET ${setClause} WHERE id = ? AND user_email = ?`;

        db.run(query, values, function(err) {
          if (err) {
            return handleDbError(res, err, 'Failed to update client');
          }

          // Return updated client
          db.get(
            'SELECT id, name, description, department, email, created_at, updated_at FROM clients WHERE id = ?',
            [clientId],
            (err, row) => {
              if (err) {
                return handleDbError(res, err, 'Client updated but failed to retrieve');
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
        return handleDbError(res, err, 'Failed to delete clients');
      }
      
      res.json({ 
        message: 'All clients deleted successfully',
        deletedCount: this.changes
      });
    }
  );
});

// Delete client
router.delete('/:id', validateIdParam('client'), (req, res) => {
  const clientId = req.parsedId;
  const db = getDatabase();
  
  // Check if client exists and belongs to user
  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, row) => {
      if (err) {
        return handleDbError(res, err);
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
            return handleDbError(res, err, 'Failed to delete client');
          }
          
          res.json({ message: 'Client deleted successfully' });
        }
      );
    }
  );
});

module.exports = router;
