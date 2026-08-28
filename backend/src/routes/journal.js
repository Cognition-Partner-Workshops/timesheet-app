const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { journalEntrySchema, updateJournalEntrySchema } = require('../validation/schemas');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Get all journal entries for authenticated user
router.get('/', (req, res) => {
  const db = getDatabase();

  db.all(
    `SELECT id, title, content, source, source_url, published_date, created_at, updated_at
     FROM journal_entries
     WHERE user_email = ?
     ORDER BY published_date DESC, created_at DESC`,
    [req.userEmail],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({ journalEntries: rows });
    }
  );
});

// Get specific journal entry
router.get('/:id', (req, res) => {
  const entryId = parseInt(req.params.id);

  if (isNaN(entryId)) {
    return res.status(400).json({ error: 'Invalid journal entry ID' });
  }

  const db = getDatabase();

  db.get(
    `SELECT id, title, content, source, source_url, published_date, created_at, updated_at
     FROM journal_entries
     WHERE id = ? AND user_email = ?`,
    [entryId, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Journal entry not found' });
      }

      res.json({ journalEntry: row });
    }
  );
});

// Create new journal entry
router.post('/', (req, res, next) => {
  try {
    const { error, value } = journalEntrySchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { title, content, source, sourceUrl, publishedDate } = value;
    const db = getDatabase();

    db.run(
      'INSERT INTO journal_entries (user_email, title, content, source, source_url, published_date) VALUES (?, ?, ?, ?, ?, ?)',
      [req.userEmail, title, content, source || null, sourceUrl || null, publishedDate || null],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to create journal entry' });
        }

        db.get(
          'SELECT id, title, content, source, source_url, published_date, created_at, updated_at FROM journal_entries WHERE id = ?',
          [this.lastID],
          (err, row) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Journal entry created but failed to retrieve' });
            }

            res.status(201).json({
              message: 'Journal entry created successfully',
              journalEntry: row
            });
          }
        );
      }
    );
  } catch (error) {
    next(error);
  }
});

// Update journal entry
router.put('/:id', (req, res, next) => {
  try {
    const entryId = parseInt(req.params.id);

    if (isNaN(entryId)) {
      return res.status(400).json({ error: 'Invalid journal entry ID' });
    }

    const { error, value } = updateJournalEntrySchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const db = getDatabase();

    db.get(
      'SELECT id FROM journal_entries WHERE id = ? AND user_email = ?',
      [entryId, req.userEmail],
      (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (!row) {
          return res.status(404).json({ error: 'Journal entry not found' });
        }

        const updates = [];
        const values = [];

        if (value.title !== undefined) {
          updates.push('title = ?');
          values.push(value.title);
        }

        if (value.content !== undefined) {
          updates.push('content = ?');
          values.push(value.content);
        }

        if (value.source !== undefined) {
          updates.push('source = ?');
          values.push(value.source || null);
        }

        if (value.sourceUrl !== undefined) {
          updates.push('source_url = ?');
          values.push(value.sourceUrl || null);
        }

        if (value.publishedDate !== undefined) {
          updates.push('published_date = ?');
          values.push(value.publishedDate || null);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(entryId, req.userEmail);

        const query = `UPDATE journal_entries SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

        db.run(query, values, function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to update journal entry' });
          }

          db.get(
            'SELECT id, title, content, source, source_url, published_date, created_at, updated_at FROM journal_entries WHERE id = ?',
            [entryId],
            (err, row) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Journal entry updated but failed to retrieve' });
              }

              res.json({
                message: 'Journal entry updated successfully',
                journalEntry: row
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

// Delete journal entry
router.delete('/:id', (req, res) => {
  const entryId = parseInt(req.params.id);

  if (isNaN(entryId)) {
    return res.status(400).json({ error: 'Invalid journal entry ID' });
  }

  const db = getDatabase();

  db.get(
    'SELECT id FROM journal_entries WHERE id = ? AND user_email = ?',
    [entryId, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Journal entry not found' });
      }

      db.run(
        'DELETE FROM journal_entries WHERE id = ? AND user_email = ?',
        [entryId, req.userEmail],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to delete journal entry' });
          }

          res.json({ message: 'Journal entry deleted successfully' });
        }
      );
    }
  );
});

// Seed Riyadh Bank news for authenticated user
router.post('/seed-news', (req, res) => {
  const db = getDatabase();

  const newsEntries = [
    {
      title: 'Riyad Bank Q1 2026 Earnings: What to Expect',
      content: 'Argaam reviews Riyad Bank\'s expected Q1 2026 results, which are due in the coming days. Riyad Bank\'s quarterly profit trends show a net profit rise in Q4 2025 driven by stronger operating income and lower provisions compared to a year earlier.',
      source: 'Argaam',
      source_url: 'https://www.argaam.com/en/reports/quarterly-overview-report-banks/57458',
      published_date: '2026-04-13'
    },
    {
      title: 'Riyad Bank Saudi Arabia PMI: Non-Oil Sector Downturn',
      content: 'The Saudi Arabian non-oil private sector economy experienced a downturn in new business as the Middle East war disrupted supply chains. The Riyad Bank Saudi Arabia PMI report highlights challenges facing businesses in the region.',
      source: 'S&P Global',
      source_url: 'https://www.pmi.spglobal.com/Public/Home/PressRelease',
      published_date: '2026-04-05'
    },
    {
      title: 'Riyad Bank Completes U.S. Dollar Tier 2 Capital Sustainable Notes',
      content: 'Riyad Bank announces the completion of the offer of its U.S. dollar denominated tier 2 capital sustainable notes under its medium term note programme, strengthening its capital position.',
      source: 'Saudi Exchange',
      source_url: 'https://www.saudiexchange.sa',
      published_date: '2026-03-15'
    },
    {
      title: 'Riyad Capital: Saudi Founding Day Offers 2026',
      content: 'Riyad Capital offers 100% discount on trading commission in the Saudi Market for three months for portfolio transfers. The offer is valid from 19 February to 19 March 2026.',
      source: 'Riyad Capital',
      source_url: 'https://www.riyadcapital.com/saudi-founding-day-offers-2026',
      published_date: '2026-02-19'
    },
    {
      title: 'Riyad Bank\'s Jeel and Ripple Launch Sandbox Partnership',
      content: 'Riyad Bank\'s digital banking platform Jeel partners with Ripple to launch a sandbox for testing blockchain-based payments in Saudi Arabia, marking a significant step toward digital payment innovation.',
      source: 'FinTech Weekly',
      source_url: 'https://www.fintechweekly.com/news/jeel-riyad-bank-ripple-sandbox',
      published_date: '2026-01-26'
    },
    {
      title: 'Riyad Capital Issues Q1 2026 Earnings Estimates',
      content: 'Riyad Capital issued Q1 2026 earnings forecasts for several banks and companies under its coverage, providing investors with guidance on expected performance across the Saudi banking sector.',
      source: 'Argaam',
      source_url: 'https://www.argaam.com/en/article/articledetail',
      published_date: '2026-04-12'
    },
    {
      title: 'Saudi Bank Deposits Surpass SR3 Trillion in February 2026',
      content: 'Saudi bank deposits surpassed SR3 trillion in February 2026, fueled by growth in government and private sector contributions. Riyad Bank is among the major banks benefiting from this trend.',
      source: 'Economy Middle East',
      source_url: 'https://www.instagram.com/p/DXJ32JrjYWG/',
      published_date: '2026-03-01'
    },
    {
      title: 'Saudi Bourse Starts 2026 on a Positive Note',
      content: 'Saudi Arabia\'s stock market rose on Thursday in the first session of the New Year. Riyad Bank shares were among the gainers as investors showed optimism for the banking sector outlook in 2026.',
      source: 'Reuters',
      source_url: 'https://www.reuters.com/world/middle-east/saudi-bourse-2026',
      published_date: '2026-01-01'
    }
  ];

  // Check if user already has journal entries
  db.get(
    'SELECT COUNT(*) as count FROM journal_entries WHERE user_email = ?',
    [req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (row.count > 0) {
        return res.json({ message: 'Journal already has entries', count: row.count });
      }

      const stmt = db.prepare(
        'INSERT INTO journal_entries (user_email, title, content, source, source_url, published_date) VALUES (?, ?, ?, ?, ?, ?)'
      );

      let inserted = 0;
      for (const entry of newsEntries) {
        stmt.run(
          [req.userEmail, entry.title, entry.content, entry.source, entry.source_url, entry.published_date],
          function(err) {
            if (err) {
              console.error('Error inserting journal entry:', err);
            } else {
              inserted++;
            }
          }
        );
      }

      stmt.finalize((err) => {
        if (err) {
          console.error('Error finalizing statement:', err);
          return res.status(500).json({ error: 'Failed to seed journal entries' });
        }

        res.status(201).json({
          message: 'Riyadh Bank news entries added to journal',
          count: newsEntries.length
        });
      });
    }
  );
});

module.exports = router;
