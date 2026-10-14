const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Get team workload dashboard data
router.get('/', (req, res) => {
  const db = getDatabase();

  // Calculate the start of the current week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  // Query 1: Team members with most hours this week
  const hoursQuery = `
    SELECT user_email, SUM(hours) as total_hours, COUNT(*) as entry_count
    FROM work_entries
    WHERE date >= ? AND date <= ?
    GROUP BY user_email
    ORDER BY total_hours DESC
  `;

  // Query 2: Upcoming deadlines (work entries with future dates)
  const today = now.toISOString().split('T')[0];
  const upcomingQuery = `
    SELECT we.id, we.user_email, we.hours, we.description, we.date,
           c.name as client_name
    FROM work_entries we
    JOIN clients c ON we.client_id = c.id
    WHERE we.date >= ?
    ORDER BY we.date ASC
    LIMIT 20
  `;

  // Query 3: Clients with most active work entries (last 30 days)
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const activeClientsQuery = `
    SELECT c.id, c.name, COUNT(we.id) as entry_count, SUM(we.hours) as total_hours,
           c.user_email
    FROM clients c
    JOIN work_entries we ON c.id = we.client_id
    WHERE we.date >= ?
    GROUP BY c.id, c.name, c.user_email
    ORDER BY entry_count DESC
    LIMIT 10
  `;

  db.all(hoursQuery, [weekStartStr, weekEndStr], (err, teamHours) => {
    if (err) {
      console.error('Database error (teamHours):', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    db.all(upcomingQuery, [today], (err, upcomingDeadlines) => {
      if (err) {
        console.error('Database error (upcomingDeadlines):', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      db.all(activeClientsQuery, [thirtyDaysAgoStr], (err, activeClients) => {
        if (err) {
          console.error('Database error (activeClients):', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        res.json({
          weekRange: {
            start: weekStartStr,
            end: weekEndStr,
          },
          teamHoursThisWeek: teamHours || [],
          upcomingDeadlines: upcomingDeadlines || [],
          activeClients: activeClients || [],
        });
      });
    });
  });
});

module.exports = router;
