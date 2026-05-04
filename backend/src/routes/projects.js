const express = require('express');
const { authenticateUser } = require('../middleware/auth');
const { projectSchema, updateProjectSchema } = require('../validation/schemas');
const {
  parseId, listAll, getOne, insertAndReturn,
  buildDynamicUpdate, checkExistsThenUpdate, deleteAll, checkExistsThenDelete,
  verifyOwnership
} = require('../helpers/crudFactory');

const router = express.Router();

router.use(authenticateUser);

const PROJECT_SELECT = `SELECT p.id, p.name, p.description, p.client_id, p.start_date, p.status, p.created_at, p.updated_at, c.name AS client_name
FROM projects p LEFT JOIN clients c ON p.client_id = c.id`;

const FIELD_MAP = {
  name: 'name',
  description: 'description',
  clientId: 'client_id',
  startDate: 'start_date',
  status: 'status'
};

router.get('/', (req, res) => {
  listAll(`${PROJECT_SELECT} WHERE p.user_email = ? ORDER BY p.name`, req.userEmail, 'projects', res);
});

router.get('/:id', (req, res) => {
  const { error, id } = parseId(req.params, 'project');
  if (error) return res.status(400).json({ error });
  getOne(`${PROJECT_SELECT} WHERE p.id = ? AND p.user_email = ?`, [id, req.userEmail], 'project', 'Project', res);
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = projectSchema.validate(req.body);
    if (error) return next(error);

    const { name, description, clientId, startDate, status } = value;

    if (clientId) {
      const check = await verifyOwnership('clients', clientId, req.userEmail, 'Client');
      if (!check.valid) return res.status(400).json({ error: check.message });
    }

    insertAndReturn(
      'INSERT INTO projects (name, description, client_id, start_date, status, user_email) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, clientId || null, startDate ? startDate.toISOString().split('T')[0] : null, status, req.userEmail],
      `${PROJECT_SELECT} WHERE p.id = ?`,
      'project', 'Project', res
    );
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { error: idError, id } = parseId(req.params, 'project');
    if (idError) return res.status(400).json({ error: idError });

    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) return next(error);

    if (value.clientId) {
      const check = await verifyOwnership('clients', value.clientId, req.userEmail, 'Client');
      if (!check.valid) return res.status(400).json({ error: check.message });
    }

    const { updates, values } = buildDynamicUpdate(FIELD_MAP, value);
    values.push(id, req.userEmail);

    checkExistsThenUpdate(
      'projects', id, req.userEmail,
      `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`,
      values, `${PROJECT_SELECT} WHERE p.id = ?`,
      'project', 'Project', res
    );
  } catch (err) {
    next(err);
  }
});

router.delete('/', (req, res) => {
  deleteAll('projects', req.userEmail, 'project', res);
});

router.delete('/:id', (req, res) => {
  const { error, id } = parseId(req.params, 'project');
  if (error) return res.status(400).json({ error });
  checkExistsThenDelete('projects', id, req.userEmail, 'Project', res);
});

module.exports = router;
