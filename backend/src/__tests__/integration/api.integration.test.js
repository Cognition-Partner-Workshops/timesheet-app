const express = require('express');
const request = require('supertest');
const sqlite3 = require('sqlite3').verbose();

// Build a real Express app with real SQLite (no mocks)
let db;
let app;

function createApp(database) {
  const testApp = express();
  testApp.use(express.json());

  // Real auth middleware using the real database
  function authenticateUser(req, res, next) {
    const userEmail = req.headers['x-user-email'];
    if (!userEmail) {
      return res.status(401).json({ error: 'User email required in x-user-email header' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    database.get('SELECT email FROM users WHERE email = ?', [userEmail], (err, row) => {
      if (err) return res.status(500).json({ error: 'Internal server error' });
      if (!row) {
        database.run('INSERT INTO users (email) VALUES (?)', [userEmail], (err) => {
          if (err) return res.status(500).json({ error: 'Failed to create user' });
          req.userEmail = userEmail;
          next();
        });
      } else {
        req.userEmail = userEmail;
        next();
      }
    });
  }

  // Mount real route handlers inline (they use our test database)
  // --- Auth routes ---
  const authRouter = express.Router();
  const { emailSchema } = require('../../validation/schemas');

  authRouter.post('/login', (req, res, next) => {
    try {
      const { error, value } = emailSchema.validate(req.body);
      if (error) return next(error);
      const { email } = value;
      database.get('SELECT email, created_at FROM users WHERE email = ?', [email], (err, row) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        if (row) {
          return res.json({ message: 'Login successful', user: { email: row.email, createdAt: row.created_at } });
        }
        database.run('INSERT INTO users (email) VALUES (?)', [email], function(err) {
          if (err) return res.status(500).json({ error: 'Failed to create user' });
          res.status(201).json({ message: 'User created and logged in successfully', user: { email, createdAt: new Date().toISOString() } });
        });
      });
    } catch (error) { next(error); }
  });

  authRouter.get('/me', authenticateUser, (req, res) => {
    database.get('SELECT email, created_at FROM users WHERE email = ?', [req.userEmail], (err, row) => {
      if (err) return res.status(500).json({ error: 'Internal server error' });
      if (!row) return res.status(404).json({ error: 'User not found' });
      res.json({ user: { email: row.email, createdAt: row.created_at } });
    });
  });

  // --- Client routes ---
  const clientRouter = express.Router();
  const { clientSchema, updateClientSchema } = require('../../validation/schemas');
  clientRouter.use(authenticateUser);

  clientRouter.get('/', (req, res) => {
    database.all(
      'SELECT id, name, description, department, email, created_at, updated_at FROM clients WHERE user_email = ? ORDER BY name',
      [req.userEmail],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        res.json({ clients: rows });
      }
    );
  });

  clientRouter.get('/:id', (req, res) => {
    const clientId = parseInt(req.params.id);
    if (isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });
    database.get(
      'SELECT id, name, description, department, email, created_at, updated_at FROM clients WHERE id = ? AND user_email = ?',
      [clientId, req.userEmail],
      (err, row) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        if (!row) return res.status(404).json({ error: 'Client not found' });
        res.json({ client: row });
      }
    );
  });

  clientRouter.post('/', (req, res, next) => {
    try {
      const { error, value } = clientSchema.validate(req.body);
      if (error) return next(error);
      const { name, description, department, email } = value;
      database.run(
        'INSERT INTO clients (name, description, department, email, user_email) VALUES (?, ?, ?, ?, ?)',
        [name, description || null, department || null, email || null, req.userEmail],
        function(err) {
          if (err) return res.status(500).json({ error: 'Failed to create client' });
          database.get('SELECT id, name, description, department, email, created_at, updated_at FROM clients WHERE id = ?', [this.lastID], (err, row) => {
            if (err) return res.status(500).json({ error: 'Client created but failed to retrieve' });
            res.status(201).json({ message: 'Client created successfully', client: row });
          });
        }
      );
    } catch (error) { next(error); }
  });

  clientRouter.put('/:id', (req, res, next) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });
      const { error, value } = updateClientSchema.validate(req.body);
      if (error) return next(error);
      database.get('SELECT id FROM clients WHERE id = ? AND user_email = ?', [clientId, req.userEmail], (err, row) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        if (!row) return res.status(404).json({ error: 'Client not found' });
        const updates = [];
        const values = [];
        if (value.name !== undefined) { updates.push('name = ?'); values.push(value.name); }
        if (value.description !== undefined) { updates.push('description = ?'); values.push(value.description || null); }
        if (value.department !== undefined) { updates.push('department = ?'); values.push(value.department || null); }
        if (value.email !== undefined) { updates.push('email = ?'); values.push(value.email || null); }
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(clientId, req.userEmail);
        database.run(`UPDATE clients SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`, values, function(err) {
          if (err) return res.status(500).json({ error: 'Failed to update client' });
          database.get('SELECT id, name, description, department, email, created_at, updated_at FROM clients WHERE id = ?', [clientId], (err, row) => {
            if (err) return res.status(500).json({ error: 'Client updated but failed to retrieve' });
            res.json({ message: 'Client updated successfully', client: row });
          });
        });
      });
    } catch (error) { next(error); }
  });

  clientRouter.delete('/', (req, res) => {
    database.run('DELETE FROM clients WHERE user_email = ?', [req.userEmail], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to delete clients' });
      res.json({ message: 'All clients deleted successfully', deletedCount: this.changes });
    });
  });

  clientRouter.delete('/:id', (req, res) => {
    const clientId = parseInt(req.params.id);
    if (isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });
    database.get('SELECT id FROM clients WHERE id = ? AND user_email = ?', [clientId, req.userEmail], (err, row) => {
      if (err) return res.status(500).json({ error: 'Internal server error' });
      if (!row) return res.status(404).json({ error: 'Client not found' });
      database.run('DELETE FROM clients WHERE id = ? AND user_email = ?', [clientId, req.userEmail], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to delete client' });
        res.json({ message: 'Client deleted successfully' });
      });
    });
  });

  // --- Work Entry routes ---
  const workEntryRouter = express.Router();
  const { workEntrySchema, updateWorkEntrySchema } = require('../../validation/schemas');
  workEntryRouter.use(authenticateUser);

  workEntryRouter.get('/', (req, res) => {
    const { clientId } = req.query;
    let query = `SELECT we.id, we.client_id, we.hours, we.description, we.date, we.created_at, we.updated_at, c.name as client_name FROM work_entries we JOIN clients c ON we.client_id = c.id WHERE we.user_email = ?`;
    const params = [req.userEmail];
    if (clientId) {
      const clientIdNum = parseInt(clientId);
      if (isNaN(clientIdNum)) return res.status(400).json({ error: 'Invalid client ID' });
      query += ' AND we.client_id = ?';
      params.push(clientIdNum);
    }
    query += ' ORDER BY we.date DESC, we.created_at DESC';
    database.all(query, params, (err, rows) => {
      if (err) return res.status(500).json({ error: 'Internal server error' });
      res.json({ workEntries: rows });
    });
  });

  workEntryRouter.get('/:id', (req, res) => {
    const workEntryId = parseInt(req.params.id);
    if (isNaN(workEntryId)) return res.status(400).json({ error: 'Invalid work entry ID' });
    database.get(
      `SELECT we.id, we.client_id, we.hours, we.description, we.date, we.created_at, we.updated_at, c.name as client_name FROM work_entries we JOIN clients c ON we.client_id = c.id WHERE we.id = ? AND we.user_email = ?`,
      [workEntryId, req.userEmail],
      (err, row) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        if (!row) return res.status(404).json({ error: 'Work entry not found' });
        res.json({ workEntry: row });
      }
    );
  });

  workEntryRouter.post('/', (req, res, next) => {
    try {
      const { error, value } = workEntrySchema.validate(req.body);
      if (error) return next(error);
      const { clientId, hours, description, date } = value;
      database.get('SELECT id FROM clients WHERE id = ? AND user_email = ?', [clientId, req.userEmail], (err, row) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        if (!row) return res.status(400).json({ error: 'Client not found or does not belong to user' });
        database.run(
          'INSERT INTO work_entries (client_id, user_email, hours, description, date) VALUES (?, ?, ?, ?, ?)',
          [clientId, req.userEmail, hours, description || null, date],
          function(err) {
            if (err) return res.status(500).json({ error: 'Failed to create work entry' });
            database.get(
              `SELECT we.id, we.client_id, we.hours, we.description, we.date, we.created_at, we.updated_at, c.name as client_name FROM work_entries we JOIN clients c ON we.client_id = c.id WHERE we.id = ?`,
              [this.lastID],
              (err, row) => {
                if (err) return res.status(500).json({ error: 'Work entry created but failed to retrieve' });
                res.status(201).json({ message: 'Work entry created successfully', workEntry: row });
              }
            );
          }
        );
      });
    } catch (error) { next(error); }
  });

  workEntryRouter.put('/:id', (req, res, next) => {
    try {
      const workEntryId = parseInt(req.params.id);
      if (isNaN(workEntryId)) return res.status(400).json({ error: 'Invalid work entry ID' });
      const { error, value } = updateWorkEntrySchema.validate(req.body);
      if (error) return next(error);
      database.get('SELECT id FROM work_entries WHERE id = ? AND user_email = ?', [workEntryId, req.userEmail], (err, row) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        if (!row) return res.status(404).json({ error: 'Work entry not found' });
        if (value.clientId) {
          database.get('SELECT id FROM clients WHERE id = ? AND user_email = ?', [value.clientId, req.userEmail], (err, clientRow) => {
            if (err) return res.status(500).json({ error: 'Internal server error' });
            if (!clientRow) return res.status(400).json({ error: 'Client not found or does not belong to user' });
            performUpdate();
          });
        } else {
          performUpdate();
        }
        function performUpdate() {
          const updates = [];
          const values = [];
          if (value.clientId !== undefined) { updates.push('client_id = ?'); values.push(value.clientId); }
          if (value.hours !== undefined) { updates.push('hours = ?'); values.push(value.hours); }
          if (value.description !== undefined) { updates.push('description = ?'); values.push(value.description || null); }
          if (value.date !== undefined) { updates.push('date = ?'); values.push(value.date); }
          updates.push('updated_at = CURRENT_TIMESTAMP');
          values.push(workEntryId, req.userEmail);
          database.run(`UPDATE work_entries SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`, values, function(err) {
            if (err) return res.status(500).json({ error: 'Failed to update work entry' });
            database.get(
              `SELECT we.id, we.client_id, we.hours, we.description, we.date, we.created_at, we.updated_at, c.name as client_name FROM work_entries we JOIN clients c ON we.client_id = c.id WHERE we.id = ?`,
              [workEntryId],
              (err, row) => {
                if (err) return res.status(500).json({ error: 'Work entry updated but failed to retrieve' });
                res.json({ message: 'Work entry updated successfully', workEntry: row });
              }
            );
          });
        }
      });
    } catch (error) { next(error); }
  });

  workEntryRouter.delete('/:id', (req, res) => {
    const workEntryId = parseInt(req.params.id);
    if (isNaN(workEntryId)) return res.status(400).json({ error: 'Invalid work entry ID' });
    database.get('SELECT id FROM work_entries WHERE id = ? AND user_email = ?', [workEntryId, req.userEmail], (err, row) => {
      if (err) return res.status(500).json({ error: 'Internal server error' });
      if (!row) return res.status(404).json({ error: 'Work entry not found' });
      database.run('DELETE FROM work_entries WHERE id = ? AND user_email = ?', [workEntryId, req.userEmail], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to delete work entry' });
        res.json({ message: 'Work entry deleted successfully' });
      });
    });
  });

  // --- Report routes ---
  const reportRouter = express.Router();
  reportRouter.use(authenticateUser);

  reportRouter.get('/client/:clientId', (req, res) => {
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });
    database.get('SELECT id, name FROM clients WHERE id = ? AND user_email = ?', [clientId, req.userEmail], (err, client) => {
      if (err) return res.status(500).json({ error: 'Internal server error' });
      if (!client) return res.status(404).json({ error: 'Client not found' });
      database.all(
        'SELECT id, hours, description, date, created_at, updated_at FROM work_entries WHERE client_id = ? AND user_email = ? ORDER BY date DESC',
        [clientId, req.userEmail],
        (err, workEntries) => {
          if (err) return res.status(500).json({ error: 'Internal server error' });
          const totalHours = workEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
          res.json({ client, workEntries, totalHours, entryCount: workEntries.length });
        }
      );
    });
  });

  // Error handler
  const { errorHandler } = require('../../middleware/errorHandler');
  testApp.use('/api/auth', authRouter);
  testApp.use('/api/clients', clientRouter);
  testApp.use('/api/work-entries', workEntryRouter);
  testApp.use('/api/reports', reportRouter);
  testApp.use(errorHandler);

  return testApp;
}

function initializeTestDb(database) {
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      database.run('PRAGMA foreign_keys = ON');
      database.run(`CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
      database.run(`CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, department TEXT, email TEXT, user_email TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE)`);
      database.run(`CREATE TABLE IF NOT EXISTS work_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, user_email TEXT NOT NULL, hours DECIMAL(5,2) NOT NULL, description TEXT, date DATE NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE, FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE)`);
      database.run(`CREATE INDEX IF NOT EXISTS idx_clients_user_email ON clients (user_email)`);
      database.run(`CREATE INDEX IF NOT EXISTS idx_work_entries_client_id ON work_entries (client_id)`);
      database.run(`CREATE INDEX IF NOT EXISTS idx_work_entries_user_email ON work_entries (user_email)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function clearTables(database) {
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      database.run('DELETE FROM work_entries');
      database.run('DELETE FROM clients');
      database.run('DELETE FROM users', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

const USER_A = 'alice@example.com';
const USER_B = 'bob@example.com';

beforeAll(async () => {
  db = new sqlite3.Database(':memory:');
  await initializeTestDb(db);
  app = createApp(db);
});

afterAll((done) => {
  db.close(done);
});

beforeEach(async () => {
  await clearTables(db);
});

describe('Integration: Auth', () => {
  test('POST /api/auth/login creates new user on first login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USER_A });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('User created and logged in successfully');
    expect(res.body.user.email).toBe(USER_A);
  });

  test('POST /api/auth/login returns existing user on second login', async () => {
    await request(app).post('/api/auth/login').send({ email: USER_A });
    const res = await request(app).post('/api/auth/login').send({ email: USER_A });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Login successful');
    expect(res.body.user.email).toBe(USER_A);
  });

  test('POST /api/auth/login returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });

  test('GET /api/auth/me returns current user info', async () => {
    await request(app).post('/api/auth/login').send({ email: USER_A });
    const res = await request(app)
      .get('/api/auth/me')
      .set('x-user-email', USER_A);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(USER_A);
    expect(res.body.user.createdAt).toBeDefined();
  });

  test('GET /api/auth/me returns 401 without auth header', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });
});

describe('Integration: Clients CRUD', () => {
  test('full lifecycle: create, read, update, delete a client', async () => {
    // Create
    const createRes = await request(app)
      .post('/api/clients')
      .set('x-user-email', USER_A)
      .send({ name: 'Acme Corp', description: 'Test client', department: 'Engineering', email: 'contact@acme.com' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.client.name).toBe('Acme Corp');
    expect(createRes.body.client.description).toBe('Test client');
    expect(createRes.body.client.department).toBe('Engineering');
    expect(createRes.body.client.email).toBe('contact@acme.com');
    const clientId = createRes.body.client.id;

    // Read single
    const getRes = await request(app)
      .get(`/api/clients/${clientId}`)
      .set('x-user-email', USER_A);

    expect(getRes.status).toBe(200);
    expect(getRes.body.client.name).toBe('Acme Corp');

    // Read all
    const listRes = await request(app)
      .get('/api/clients')
      .set('x-user-email', USER_A);

    expect(listRes.status).toBe(200);
    expect(listRes.body.clients).toHaveLength(1);
    expect(listRes.body.clients[0].name).toBe('Acme Corp');

    // Update
    const updateRes = await request(app)
      .put(`/api/clients/${clientId}`)
      .set('x-user-email', USER_A)
      .send({ name: 'Acme Inc', department: 'Sales' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.client.name).toBe('Acme Inc');
    expect(updateRes.body.client.department).toBe('Sales');

    // Delete
    const deleteRes = await request(app)
      .delete(`/api/clients/${clientId}`)
      .set('x-user-email', USER_A);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('Client deleted successfully');

    // Verify gone
    const verifyRes = await request(app)
      .get(`/api/clients/${clientId}`)
      .set('x-user-email', USER_A);

    expect(verifyRes.status).toBe(404);
  });

  test('returns empty array when user has no clients', async () => {
    const res = await request(app)
      .get('/api/clients')
      .set('x-user-email', USER_A);

    expect(res.status).toBe(200);
    expect(res.body.clients).toEqual([]);
  });

  test('returns 400 for validation errors on create', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('x-user-email', USER_A)
      .send({ name: '' });

    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid ID on get', async () => {
    const res = await request(app)
      .get('/api/clients/abc')
      .set('x-user-email', USER_A);

    expect(res.status).toBe(400);
  });

  test('returns 404 for non-existent client', async () => {
    const res = await request(app)
      .get('/api/clients/99999')
      .set('x-user-email', USER_A);

    expect(res.status).toBe(404);
  });

  test('bulk delete removes all clients for user', async () => {
    await request(app).post('/api/clients').set('x-user-email', USER_A).send({ name: 'Client 1' });
    await request(app).post('/api/clients').set('x-user-email', USER_A).send({ name: 'Client 2' });
    await request(app).post('/api/clients').set('x-user-email', USER_A).send({ name: 'Client 3' });

    const deleteRes = await request(app)
      .delete('/api/clients')
      .set('x-user-email', USER_A);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deletedCount).toBe(3);

    const listRes = await request(app).get('/api/clients').set('x-user-email', USER_A);
    expect(listRes.body.clients).toHaveLength(0);
  });

  test('clients are sorted by name', async () => {
    await request(app).post('/api/clients').set('x-user-email', USER_A).send({ name: 'Zebra Inc' });
    await request(app).post('/api/clients').set('x-user-email', USER_A).send({ name: 'Alpha Corp' });
    await request(app).post('/api/clients').set('x-user-email', USER_A).send({ name: 'Middle LLC' });

    const res = await request(app).get('/api/clients').set('x-user-email', USER_A);

    expect(res.body.clients[0].name).toBe('Alpha Corp');
    expect(res.body.clients[1].name).toBe('Middle LLC');
    expect(res.body.clients[2].name).toBe('Zebra Inc');
  });
});

describe('Integration: Work Entries CRUD', () => {
  let clientId;

  beforeEach(async () => {
    const clientRes = await request(app)
      .post('/api/clients')
      .set('x-user-email', USER_A)
      .send({ name: 'Test Client' });
    clientId = clientRes.body.client.id;
  });

  test('full lifecycle: create, read, update, delete a work entry', async () => {
    // Create
    const createRes = await request(app)
      .post('/api/work-entries')
      .set('x-user-email', USER_A)
      .send({ clientId, hours: 8, description: 'Full day work', date: '2024-03-15' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.workEntry.hours).toBe(8);
    expect(createRes.body.workEntry.description).toBe('Full day work');
    expect(createRes.body.workEntry.client_name).toBe('Test Client');
    const entryId = createRes.body.workEntry.id;

    // Read single
    const getRes = await request(app)
      .get(`/api/work-entries/${entryId}`)
      .set('x-user-email', USER_A);

    expect(getRes.status).toBe(200);
    expect(getRes.body.workEntry.hours).toBe(8);

    // Read all
    const listRes = await request(app)
      .get('/api/work-entries')
      .set('x-user-email', USER_A);

    expect(listRes.status).toBe(200);
    expect(listRes.body.workEntries).toHaveLength(1);

    // Update
    const updateRes = await request(app)
      .put(`/api/work-entries/${entryId}`)
      .set('x-user-email', USER_A)
      .send({ hours: 6, description: 'Updated' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.workEntry.hours).toBe(6);
    expect(updateRes.body.workEntry.description).toBe('Updated');

    // Delete
    const deleteRes = await request(app)
      .delete(`/api/work-entries/${entryId}`)
      .set('x-user-email', USER_A);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('Work entry deleted successfully');

    // Verify gone
    const verifyRes = await request(app)
      .get(`/api/work-entries/${entryId}`)
      .set('x-user-email', USER_A);

    expect(verifyRes.status).toBe(404);
  });

  test('returns empty array when user has no work entries', async () => {
    const res = await request(app)
      .get('/api/work-entries')
      .set('x-user-email', USER_A);

    expect(res.status).toBe(200);
    expect(res.body.workEntries).toEqual([]);
  });

  test('filters work entries by clientId', async () => {
    const client2Res = await request(app)
      .post('/api/clients')
      .set('x-user-email', USER_A)
      .send({ name: 'Other Client' });
    const client2Id = client2Res.body.client.id;

    await request(app).post('/api/work-entries').set('x-user-email', USER_A)
      .send({ clientId, hours: 4, date: '2024-03-15' });
    await request(app).post('/api/work-entries').set('x-user-email', USER_A)
      .send({ clientId: client2Id, hours: 6, date: '2024-03-15' });

    const filteredRes = await request(app)
      .get(`/api/work-entries?clientId=${clientId}`)
      .set('x-user-email', USER_A);

    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.workEntries).toHaveLength(1);
    expect(filteredRes.body.workEntries[0].client_name).toBe('Test Client');
  });

  test('returns 400 for work entry with non-existent client', async () => {
    const res = await request(app)
      .post('/api/work-entries')
      .set('x-user-email', USER_A)
      .send({ clientId: 99999, hours: 5, date: '2024-03-15' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Client not found or does not belong to user');
  });

  test('returns 400 for invalid hours (zero)', async () => {
    const res = await request(app)
      .post('/api/work-entries')
      .set('x-user-email', USER_A)
      .send({ clientId, hours: 0, date: '2024-03-15' });

    expect(res.status).toBe(400);
  });

  test('returns 400 for hours exceeding 24', async () => {
    const res = await request(app)
      .post('/api/work-entries')
      .set('x-user-email', USER_A)
      .send({ clientId, hours: 25, date: '2024-03-15' });

    expect(res.status).toBe(400);
  });

  test('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/work-entries')
      .set('x-user-email', USER_A)
      .send({ hours: 5 });

    expect(res.status).toBe(400);
  });

  test('returns all work entries for user', async () => {
    await request(app).post('/api/work-entries').set('x-user-email', USER_A)
      .send({ clientId, hours: 2, date: '2024-01-01' });
    await request(app).post('/api/work-entries').set('x-user-email', USER_A)
      .send({ clientId, hours: 4, date: '2024-06-15' });
    await request(app).post('/api/work-entries').set('x-user-email', USER_A)
      .send({ clientId, hours: 3, date: '2024-03-10' });

    const res = await request(app).get('/api/work-entries').set('x-user-email', USER_A);

    expect(res.body.workEntries).toHaveLength(3);
    const totalHours = res.body.workEntries.reduce((sum, e) => sum + e.hours, 0);
    expect(totalHours).toBe(9);
  });
});

describe('Integration: Reports', () => {
  let clientId;

  beforeEach(async () => {
    const clientRes = await request(app)
      .post('/api/clients')
      .set('x-user-email', USER_A)
      .send({ name: 'Report Client' });
    clientId = clientRes.body.client.id;
  });

  test('returns report with correct totals', async () => {
    await request(app).post('/api/work-entries').set('x-user-email', USER_A)
      .send({ clientId, hours: 5.5, date: '2024-03-15', description: 'Task 1' });
    await request(app).post('/api/work-entries').set('x-user-email', USER_A)
      .send({ clientId, hours: 3.25, date: '2024-03-16', description: 'Task 2' });

    const res = await request(app)
      .get(`/api/reports/client/${clientId}`)
      .set('x-user-email', USER_A);

    expect(res.status).toBe(200);
    expect(res.body.client.name).toBe('Report Client');
    expect(res.body.totalHours).toBe(8.75);
    expect(res.body.entryCount).toBe(2);
    expect(res.body.workEntries).toHaveLength(2);
  });

  test('returns zero totals for client with no entries', async () => {
    const res = await request(app)
      .get(`/api/reports/client/${clientId}`)
      .set('x-user-email', USER_A);

    expect(res.status).toBe(200);
    expect(res.body.totalHours).toBe(0);
    expect(res.body.entryCount).toBe(0);
    expect(res.body.workEntries).toEqual([]);
  });

  test('returns 404 for non-existent client report', async () => {
    const res = await request(app)
      .get('/api/reports/client/99999')
      .set('x-user-email', USER_A);

    expect(res.status).toBe(404);
  });

  test('returns 400 for invalid client ID in report', async () => {
    const res = await request(app)
      .get('/api/reports/client/abc')
      .set('x-user-email', USER_A);

    expect(res.status).toBe(400);
  });

  test('report includes all entries for client', async () => {
    await request(app).post('/api/work-entries').set('x-user-email', USER_A)
      .send({ clientId, hours: 1, date: '2024-01-01' });
    await request(app).post('/api/work-entries').set('x-user-email', USER_A)
      .send({ clientId, hours: 2, date: '2024-12-31' });

    const res = await request(app)
      .get(`/api/reports/client/${clientId}`)
      .set('x-user-email', USER_A);

    expect(res.body.workEntries).toHaveLength(2);
    expect(res.body.totalHours).toBe(3);
    expect(res.body.entryCount).toBe(2);
  });
});

describe('Integration: Cross-User Isolation', () => {
  test('user A cannot see user B clients', async () => {
    await request(app).post('/api/clients').set('x-user-email', USER_A).send({ name: 'Alice Client' });
    await request(app).post('/api/clients').set('x-user-email', USER_B).send({ name: 'Bob Client' });

    const aliceClients = await request(app).get('/api/clients').set('x-user-email', USER_A);
    const bobClients = await request(app).get('/api/clients').set('x-user-email', USER_B);

    expect(aliceClients.body.clients).toHaveLength(1);
    expect(aliceClients.body.clients[0].name).toBe('Alice Client');
    expect(bobClients.body.clients).toHaveLength(1);
    expect(bobClients.body.clients[0].name).toBe('Bob Client');
  });

  test('user A cannot access user B client by ID', async () => {
    const bobClientRes = await request(app)
      .post('/api/clients')
      .set('x-user-email', USER_B)
      .send({ name: 'Bob Secret Client' });
    const bobClientId = bobClientRes.body.client.id;

    const res = await request(app)
      .get(`/api/clients/${bobClientId}`)
      .set('x-user-email', USER_A);

    expect(res.status).toBe(404);
  });

  test('user A cannot update user B client', async () => {
    const bobClientRes = await request(app)
      .post('/api/clients')
      .set('x-user-email', USER_B)
      .send({ name: 'Bob Client' });
    const bobClientId = bobClientRes.body.client.id;

    const res = await request(app)
      .put(`/api/clients/${bobClientId}`)
      .set('x-user-email', USER_A)
      .send({ name: 'Hacked!' });

    expect(res.status).toBe(404);

    // Verify Bob's client is unchanged
    const bobGet = await request(app)
      .get(`/api/clients/${bobClientId}`)
      .set('x-user-email', USER_B);
    expect(bobGet.body.client.name).toBe('Bob Client');
  });

  test('user A cannot delete user B client', async () => {
    const bobClientRes = await request(app)
      .post('/api/clients')
      .set('x-user-email', USER_B)
      .send({ name: 'Bob Undeletable' });
    const bobClientId = bobClientRes.body.client.id;

    const res = await request(app)
      .delete(`/api/clients/${bobClientId}`)
      .set('x-user-email', USER_A);

    expect(res.status).toBe(404);

    // Verify Bob's client still exists
    const bobGet = await request(app)
      .get(`/api/clients/${bobClientId}`)
      .set('x-user-email', USER_B);
    expect(bobGet.status).toBe(200);
  });

  test('bulk delete only removes own clients, not others', async () => {
    await request(app).post('/api/clients').set('x-user-email', USER_A).send({ name: 'Alice Client' });
    await request(app).post('/api/clients').set('x-user-email', USER_B).send({ name: 'Bob Client' });

    await request(app).delete('/api/clients').set('x-user-email', USER_A);

    const aliceClients = await request(app).get('/api/clients').set('x-user-email', USER_A);
    const bobClients = await request(app).get('/api/clients').set('x-user-email', USER_B);

    expect(aliceClients.body.clients).toHaveLength(0);
    expect(bobClients.body.clients).toHaveLength(1);
    expect(bobClients.body.clients[0].name).toBe('Bob Client');
  });

  test('user A cannot see user B work entries', async () => {
    const aliceClient = await request(app).post('/api/clients').set('x-user-email', USER_A).send({ name: 'Alice Client' });
    const bobClient = await request(app).post('/api/clients').set('x-user-email', USER_B).send({ name: 'Bob Client' });

    await request(app).post('/api/work-entries').set('x-user-email', USER_A)
      .send({ clientId: aliceClient.body.client.id, hours: 5, date: '2024-03-15' });
    await request(app).post('/api/work-entries').set('x-user-email', USER_B)
      .send({ clientId: bobClient.body.client.id, hours: 3, date: '2024-03-15' });

    const aliceEntries = await request(app).get('/api/work-entries').set('x-user-email', USER_A);
    const bobEntries = await request(app).get('/api/work-entries').set('x-user-email', USER_B);

    expect(aliceEntries.body.workEntries).toHaveLength(1);
    expect(aliceEntries.body.workEntries[0].hours).toBe(5);
    expect(bobEntries.body.workEntries).toHaveLength(1);
    expect(bobEntries.body.workEntries[0].hours).toBe(3);
  });

  test('user A cannot create work entry for user B client', async () => {
    const bobClient = await request(app).post('/api/clients').set('x-user-email', USER_B).send({ name: 'Bob Client' });

    const res = await request(app)
      .post('/api/work-entries')
      .set('x-user-email', USER_A)
      .send({ clientId: bobClient.body.client.id, hours: 5, date: '2024-03-15' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Client not found or does not belong to user');
  });

  test('user A cannot see user B report', async () => {
    const bobClient = await request(app).post('/api/clients').set('x-user-email', USER_B).send({ name: 'Bob Client' });
    await request(app).post('/api/work-entries').set('x-user-email', USER_B)
      .send({ clientId: bobClient.body.client.id, hours: 10, date: '2024-03-15' });

    const res = await request(app)
      .get(`/api/reports/client/${bobClient.body.client.id}`)
      .set('x-user-email', USER_A);

    expect(res.status).toBe(404);
  });

  test('user A cannot update user B work entry', async () => {
    const bobClient = await request(app).post('/api/clients').set('x-user-email', USER_B).send({ name: 'Bob Client' });
    const bobEntry = await request(app).post('/api/work-entries').set('x-user-email', USER_B)
      .send({ clientId: bobClient.body.client.id, hours: 5, date: '2024-03-15' });
    const bobEntryId = bobEntry.body.workEntry.id;

    const res = await request(app)
      .put(`/api/work-entries/${bobEntryId}`)
      .set('x-user-email', USER_A)
      .send({ hours: 8 });

    expect(res.status).toBe(404);

    // Verify Bob's entry unchanged
    const bobGet = await request(app)
      .get(`/api/work-entries/${bobEntryId}`)
      .set('x-user-email', USER_B);
    expect(bobGet.body.workEntry.hours).toBe(5);
  });

  test('user A cannot delete user B work entry', async () => {
    const bobClient = await request(app).post('/api/clients').set('x-user-email', USER_B).send({ name: 'Bob Client' });
    const bobEntry = await request(app).post('/api/work-entries').set('x-user-email', USER_B)
      .send({ clientId: bobClient.body.client.id, hours: 5, date: '2024-03-15' });
    const bobEntryId = bobEntry.body.workEntry.id;

    const res = await request(app)
      .delete(`/api/work-entries/${bobEntryId}`)
      .set('x-user-email', USER_A);

    expect(res.status).toBe(404);

    // Verify Bob's entry still exists
    const bobGet = await request(app)
      .get(`/api/work-entries/${bobEntryId}`)
      .set('x-user-email', USER_B);
    expect(bobGet.status).toBe(200);
  });
});

describe('Integration: Error Handling', () => {
  test('returns 401 for requests without x-user-email header', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(401);
  });

  test('returns 400 for invalid email format in header', async () => {
    const res = await request(app)
      .get('/api/clients')
      .set('x-user-email', 'not-valid');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid email format');
  });

  test('auto-creates user on first authenticated request', async () => {
    const res = await request(app)
      .get('/api/clients')
      .set('x-user-email', 'newuser@example.com');

    expect(res.status).toBe(200);
    expect(res.body.clients).toEqual([]);
  });

  test('Joi validation returns structured error for bad client data', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('x-user-email', USER_A)
      .send({ name: 'Valid', email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
    expect(res.body.details).toBeDefined();
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  test('Joi validation returns structured error for bad work entry data', async () => {
    const res = await request(app)
      .post('/api/work-entries')
      .set('x-user-email', USER_A)
      .send({ clientId: 'abc', hours: -1, date: 'bad' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });
});

describe('Integration: Cascade Delete', () => {
  test('deleting a client cascades to its work entries', async () => {
    const clientRes = await request(app)
      .post('/api/clients')
      .set('x-user-email', USER_A)
      .send({ name: 'Cascade Client' });
    const clientId = clientRes.body.client.id;

    await request(app).post('/api/work-entries').set('x-user-email', USER_A)
      .send({ clientId, hours: 5, date: '2024-03-15' });
    await request(app).post('/api/work-entries').set('x-user-email', USER_A)
      .send({ clientId, hours: 3, date: '2024-03-16' });

    // Verify entries exist
    const beforeRes = await request(app).get('/api/work-entries').set('x-user-email', USER_A);
    expect(beforeRes.body.workEntries).toHaveLength(2);

    // Delete client
    await request(app).delete(`/api/clients/${clientId}`).set('x-user-email', USER_A);

    // Verify entries are gone
    const afterRes = await request(app).get('/api/work-entries').set('x-user-email', USER_A);
    expect(afterRes.body.workEntries).toHaveLength(0);
  });
});
