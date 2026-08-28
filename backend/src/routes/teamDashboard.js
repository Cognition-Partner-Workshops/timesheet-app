const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Get team workload dashboard data
router.get('/', (req, res) => {
  const db = getDatabase();

  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const sundayEnd = new Date(weekStart);
  sundayEnd.setDate(weekStart.getDate() + 6);
  const weekEndStr = sundayEnd.toISOString().split('T')[0];

  const upcomingEnd = new Date(now);
  upcomingEnd.setDate(now.getDate() + 7);
  const todayStr = now.toISOString().split('T')[0];
  const upcomingEndStr = upcomingEnd.toISOString().split('T')[0];

  const results = {
    topHoursThisWeek: [],
    upcomingDeadlines: [],
    mostActiveClients: [],
  };

  // Query 1: Team members with most hours this week
  db.all(
    `SELECT user_email, SUM(hours) as total_hours, COUNT(*) as entry_count
     FROM work_entries
     WHERE date >= ? AND date <= ?
     GROUP BY user_email
     ORDER BY total_hours DESC
     LIMIT 10`,
    [weekStartStr, weekEndStr],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      results.topHoursThisWeek = rows || [];

      // Query 2: Upcoming deadlines (work entries scheduled in the next 7 days)
      db.all(
        `SELECT we.id, we.user_email, we.hours, we.description, we.date,
                c.name as client_name
         FROM work_entries we
         JOIN clients c ON we.client_id = c.id
         WHERE we.date >= ? AND we.date <= ?
         ORDER BY we.date ASC
         LIMIT 20`,
        [todayStr, upcomingEndStr],
        (err, rows) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }

          results.upcomingDeadlines = rows || [];

          // Query 3: Clients with most active work entries
          db.all(
            `SELECT c.id, c.name, c.department, COUNT(we.id) as entry_count,
                    SUM(we.hours) as total_hours
             FROM clients c
             JOIN work_entries we ON c.id = we.client_id
             GROUP BY c.id, c.name, c.department
             ORDER BY entry_count DESC
             LIMIT 10`,
            [],
            (err, rows) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
              }

              results.mostActiveClients = rows || [];

              res.json(results);
            }
          );
        }
      );
    }
  );
});

module.exports = router;
