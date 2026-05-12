const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { clientSchema, updateClientSchema } = require('../validation/schemas');
const { parseResourceId, handleDbError, findOwnedResource, buildDynamicUpdate } = require('./helpers');

const router = express.Router();

router.use(authenticateUser);

const CLIENT_COLUMNS = 'id, name, description, department, email, created_at, updated_at';

const CLIENT_FIELD_MAP = {
  name: { column: 'name', nullable: false },
  description: { column: 'description', nullable: true },
  department: { column: 'department', nullable: true },
  email: { column: 'email', nullable: true }
};

router.get('/', (req, res) => {
  const db = getDatabase();
  db.all(
    `SELECT ${CLIENT_COLUMNS} FROM clients WHERE user_email = ? ORDER BY name`,
    [req.userEmail],
    (err, rows) => {
      if (err) return handleDbError(res, err);
      res.json({ clients: rows });
    }
  );
});

router.get('/:id', (req, res) => {
  const clientId = parseResourceId(req, res, 'client');
  if (clientId === null) return;

  const db = getDatabase();
  db.get(
    `SELECT ${CLIENT_COLUMNS} FROM clients WHERE id = ? AND user_email = ?`,
    [clientId, req.userEmail],
    (err, row) => {
      if (err) return handleDbError(res, err);
      if (!row) return res.status(404).json({ error: 'Client not found' });
      res.json({ client: row });
    }
  );
});

router.post('/', (req, res, next) => {
  try {
    const { error, value } = clientSchema.validate(req.body);
    if (error) return next(error);

    const { name, description, department, email } = value;
    const db = getDatabase();

    db.run(
      'INSERT INTO clients (name, description, department, email, user_email) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, department || null, email || null, req.userEmail],
      function(err) {
        if (err) return handleDbError(res, err, 'Failed to create client');

        db.get(
          `SELECT ${CLIENT_COLUMNS} FROM clients WHERE id = ?`,
          [this.lastID],
          (err, row) => {
            if (err) return handleDbError(res, err, 'Client created but failed to retrieve');
            res.status(201).json({ message: 'Client created successfully', client: row });
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
    const clientId = parseResourceId(req, res, 'client');
    if (clientId === null) return;

    const { error, value } = updateClientSchema.validate(req.body);
    if (error) return next(error);

    findOwnedResource('clients', clientId, req.userEmail, (err, row) => {
      if (err) return handleDbError(res, err);
      if (!row) return res.status(404).json({ error: 'Client not found' });

      const { updates, values } = buildDynamicUpdate('clients', CLIENT_FIELD_MAP, value);
      values.push(clientId, req.userEmail);

      const db = getDatabase();
      db.run(
        `UPDATE clients SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`,
        values,
        function(err) {
          if (err) return handleDbError(res, err, 'Failed to update client');

          db.get(
            `SELECT ${CLIENT_COLUMNS} FROM clients WHERE id = ?`,
            [clientId],
            (err, row) => {
              if (err) return handleDbError(res, err, 'Client updated but failed to retrieve');
              res.json({ message: 'Client updated successfully', client: row });
            }
          );
        }
      );
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/', (req, res) => {
  const db = getDatabase();
  db.run(
    'DELETE FROM clients WHERE user_email = ?',
    [req.userEmail],
    function(err) {
      if (err) return handleDbError(res, err, 'Failed to delete clients');
      res.json({ message: 'All clients deleted successfully', deletedCount: this.changes });
    }
  );
});

router.delete('/:id', (req, res) => {
  const clientId = parseResourceId(req, res, 'client');
  if (clientId === null) return;

  findOwnedResource('clients', clientId, req.userEmail, (err, row) => {
    if (err) return handleDbError(res, err);
    if (!row) return res.status(404).json({ error: 'Client not found' });

    const db = getDatabase();
    db.run(
      'DELETE FROM clients WHERE id = ? AND user_email = ?',
      [clientId, req.userEmail],
      function(err) {
        if (err) return handleDbError(res, err, 'Failed to delete client');
        res.json({ message: 'Client deleted successfully' });
      }
    );
  });
});

module.exports = router;
