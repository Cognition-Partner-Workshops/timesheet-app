const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { recurringTemplateSchema, updateRecurringTemplateSchema, generateEntriesSchema } = require('../validation/schemas');
const { eachDayOfInterval, getDay, parseISO, format, addWeeks } = require('date-fns');

const router = express.Router();

router.use(authenticateUser);

// Map day-of-week bitmask: 1=Mon,2=Tue,4=Wed,8=Thu,16=Fri,32=Sat,64=Sun
function dayMatchesBitmask(date, bitmask) {
  const jsDay = getDay(date); // 0=Sun,1=Mon,...,6=Sat
  const bitMap = [64, 1, 2, 4, 8, 16, 32]; // maps JS getDay index to bitmask
  return (bitmask & bitMap[jsDay]) !== 0;
}

function generateDatesForTemplate(template, from, to) {
  const startDate = parseISO(from);
  const endDate = parseISO(to);
  const allDays = eachDayOfInterval({ start: startDate, end: endDate });

  if (template.frequency === 'daily') {
    return allDays.filter(d => dayMatchesBitmask(d, template.days_of_week));
  }

  if (template.frequency === 'weekly') {
    return allDays.filter(d => dayMatchesBitmask(d, template.days_of_week));
  }

  if (template.frequency === 'biweekly') {
    const templateStart = parseISO(template.start_date);
    return allDays.filter(d => {
      if (!dayMatchesBitmask(d, template.days_of_week)) return false;
      const diffMs = d.getTime() - templateStart.getTime();
      const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
      return diffWeeks % 2 === 0;
    });
  }

  if (template.frequency === 'monthly') {
    const templateStartDay = parseISO(template.start_date).getDate();
    return allDays.filter(d => d.getDate() === templateStartDay);
  }

  return [];
}

// GET / — list user's templates
router.get('/', (req, res) => {
  const db = getDatabase();
  db.all(
    `SELECT rt.*, c.name as client_name
     FROM recurring_templates rt
     JOIN clients c ON rt.client_id = c.id
     WHERE rt.user_email = ?
     ORDER BY rt.created_at DESC`,
    [req.userEmail],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ templates: rows });
    }
  );
});

// POST / — create template
router.post('/', (req, res, next) => {
  const { error, value } = recurringTemplateSchema.validate(req.body);
  if (error) return next(error);

  const { clientId, hours, description, frequency, daysOfWeek, startDate, endDate } = value;
  const db = getDatabase();

  db.get('SELECT id FROM clients WHERE id = ? AND user_email = ?', [clientId, req.userEmail], (err, row) => {
    if (err) return res.status(500).json({ error: 'Internal server error' });
    if (!row) return res.status(400).json({ error: 'Client not found or does not belong to user' });

    db.run(
      `INSERT INTO recurring_templates (user_email, client_id, hours, description, frequency, days_of_week, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userEmail, clientId, hours, description || null, frequency, daysOfWeek, startDate, endDate || null],
      function(err) {
        if (err) return res.status(500).json({ error: 'Failed to create template' });
        db.get(
          `SELECT rt.*, c.name as client_name FROM recurring_templates rt JOIN clients c ON rt.client_id = c.id WHERE rt.id = ?`,
          [this.lastID],
          (err, row) => {
            if (err) return res.status(500).json({ error: 'Template created but failed to retrieve' });
            res.status(201).json({ message: 'Template created successfully', template: row });
          }
        );
      }
    );
  });
});

// PUT /:id — update template
router.put('/:id', (req, res, next) => {
  const templateId = parseInt(req.params.id);
  if (isNaN(templateId)) return res.status(400).json({ error: 'Invalid template ID' });

  const { error, value } = updateRecurringTemplateSchema.validate(req.body);
  if (error) return next(error);

  const db = getDatabase();

  db.get('SELECT id FROM recurring_templates WHERE id = ? AND user_email = ?', [templateId, req.userEmail], (err, row) => {
    if (err) return res.status(500).json({ error: 'Internal server error' });
    if (!row) return res.status(404).json({ error: 'Template not found' });

    const fields = [];
    const params = [];
    const fieldMap = {
      clientId: 'client_id', hours: 'hours', description: 'description',
      frequency: 'frequency', daysOfWeek: 'days_of_week', startDate: 'start_date',
      endDate: 'end_date', active: 'active'
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (value[key] !== undefined) {
        fields.push(`${col} = ?`);
        params.push(key === 'active' ? (value[key] ? 1 : 0) : value[key]);
      }
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(templateId, req.userEmail);

    db.run(
      `UPDATE recurring_templates SET ${fields.join(', ')} WHERE id = ? AND user_email = ?`,
      params,
      function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update template' });
        db.get(
          `SELECT rt.*, c.name as client_name FROM recurring_templates rt JOIN clients c ON rt.client_id = c.id WHERE rt.id = ?`,
          [templateId],
          (err, row) => {
            if (err) return res.status(500).json({ error: 'Internal server error' });
            res.json({ message: 'Template updated successfully', template: row });
          }
        );
      }
    );
  });
});

// DELETE /:id — delete template
router.delete('/:id', (req, res) => {
  const templateId = parseInt(req.params.id);
  if (isNaN(templateId)) return res.status(400).json({ error: 'Invalid template ID' });

  const db = getDatabase();
  db.run('DELETE FROM recurring_templates WHERE id = ? AND user_email = ?', [templateId, req.userEmail], function(err) {
    if (err) return res.status(500).json({ error: 'Internal server error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ message: 'Template deleted successfully' });
  });
});

// POST /:id/generate — preview entries for a date range
router.post('/:id/generate', (req, res, next) => {
  const templateId = parseInt(req.params.id);
  if (isNaN(templateId)) return res.status(400).json({ error: 'Invalid template ID' });

  const { error, value } = generateEntriesSchema.validate(req.body);
  if (error) return next(error);

  const db = getDatabase();
  db.get(
    `SELECT rt.*, c.name as client_name FROM recurring_templates rt JOIN clients c ON rt.client_id = c.id WHERE rt.id = ? AND rt.user_email = ?`,
    [templateId, req.userEmail],
    (err, template) => {
      if (err) return res.status(500).json({ error: 'Internal server error' });
      if (!template) return res.status(404).json({ error: 'Template not found' });

      const fromStr = format(new Date(value.from), 'yyyy-MM-dd');
      const toStr = format(new Date(value.to), 'yyyy-MM-dd');
      const dates = generateDatesForTemplate(template, fromStr, toStr);

      const entries = dates.map(d => ({
        date: format(d, 'yyyy-MM-dd'),
        clientId: template.client_id,
        clientName: template.client_name,
        hours: template.hours,
        description: template.description
      }));

      res.json({ entries, count: entries.length });
    }
  );
});

// POST /:id/apply — actually create work entries for date range
router.post('/:id/apply', (req, res, next) => {
  const templateId = parseInt(req.params.id);
  if (isNaN(templateId)) return res.status(400).json({ error: 'Invalid template ID' });

  const { error, value } = generateEntriesSchema.validate(req.body);
  if (error) return next(error);

  const db = getDatabase();
  db.get(
    `SELECT rt.*, c.name as client_name FROM recurring_templates rt JOIN clients c ON rt.client_id = c.id WHERE rt.id = ? AND rt.user_email = ?`,
    [templateId, req.userEmail],
    (err, template) => {
      if (err) return res.status(500).json({ error: 'Internal server error' });
      if (!template) return res.status(404).json({ error: 'Template not found' });

      const fromStr = format(new Date(value.from), 'yyyy-MM-dd');
      const toStr = format(new Date(value.to), 'yyyy-MM-dd');
      const dates = generateDatesForTemplate(template, fromStr, toStr);

      if (dates.length === 0) {
        return res.json({ message: 'No entries to create', created: 0 });
      }

      const stmt = db.prepare(
        'INSERT INTO work_entries (client_id, user_email, hours, description, date) VALUES (?, ?, ?, ?, ?)'
      );

      let created = 0;
      db.serialize(() => {
        for (const d of dates) {
          stmt.run(
            [template.client_id, req.userEmail, template.hours, template.description, format(d, 'yyyy-MM-dd')],
            (err) => { if (!err) created++; }
          );
        }
        stmt.finalize((err) => {
          if (err) return res.status(500).json({ error: 'Failed to create entries' });
          res.status(201).json({ message: `Created ${dates.length} work entries`, created: dates.length });
        });
      });
    }
  );
});

module.exports = router;
