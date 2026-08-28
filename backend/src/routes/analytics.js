const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateUser);

// Weekly feature usage for the last 8 weeks
router.get('/feature-usage/weekly', (req, res) => {
  const db = getDatabase();

  db.all(
    `SELECT
       feature_family,
       strftime('%Y-%W', created_at) AS week,
       strftime('%Y-%m-%d', created_at, 'weekday 0', '-6 days') AS week_start,
       COUNT(*) AS usage_count,
       COUNT(DISTINCT user_email) AS unique_users
     FROM feature_usage
     WHERE created_at >= datetime('now', '-56 days')
     GROUP BY feature_family, week
     ORDER BY week ASC, feature_family ASC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      const families = {};
      for (const row of rows) {
        if (!families[row.feature_family]) {
          families[row.feature_family] = [];
        }
        families[row.feature_family].push({
          week: row.week,
          weekStart: row.week_start,
          usageCount: row.usage_count,
          uniqueUsers: row.unique_users,
        });
      }

      res.json({ weeklyUsage: families });
    }
  );
});

// Trend data: week-over-week change per feature family
router.get('/feature-usage/trends', (req, res) => {
  const db = getDatabase();

  db.all(
    `WITH current_week AS (
       SELECT feature_family,
              COUNT(*) AS usage_count,
              COUNT(DISTINCT user_email) AS unique_users
       FROM feature_usage
       WHERE created_at >= datetime('now', '-7 days')
       GROUP BY feature_family
     ),
     previous_week AS (
       SELECT feature_family,
              COUNT(*) AS usage_count,
              COUNT(DISTINCT user_email) AS unique_users
       FROM feature_usage
       WHERE created_at >= datetime('now', '-14 days')
         AND created_at < datetime('now', '-7 days')
       GROUP BY feature_family
     ),
     all_families AS (
       SELECT DISTINCT feature_family FROM feature_usage
     )
     SELECT
       af.feature_family,
       COALESCE(cw.usage_count, 0) AS current_count,
       COALESCE(pw.usage_count, 0) AS previous_count,
       COALESCE(cw.unique_users, 0) AS current_users,
       COALESCE(pw.unique_users, 0) AS previous_users
     FROM all_families af
     LEFT JOIN current_week cw ON af.feature_family = cw.feature_family
     LEFT JOIN previous_week pw ON af.feature_family = pw.feature_family
     ORDER BY af.feature_family`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      const trends = rows.map((row) => {
        const prevCount = row.previous_count || 0;
        const currCount = row.current_count || 0;
        let percentChange = 0;
        if (prevCount > 0) {
          percentChange = ((currCount - prevCount) / prevCount) * 100;
        } else if (currCount > 0) {
          percentChange = 100;
        }

        let traction;
        if (percentChange > 10) traction = 'gaining';
        else if (percentChange < -10) traction = 'losing';
        else traction = 'stable';

        return {
          featureFamily: row.feature_family,
          currentWeekCount: currCount,
          previousWeekCount: prevCount,
          percentChange: Math.round(percentChange * 10) / 10,
          traction,
          currentUsers: row.current_users,
          previousUsers: row.previous_users,
        };
      });

      res.json({ trends });
    }
  );
});

// Detailed breakdown: actions within each feature family
router.get('/feature-usage/breakdown', (req, res) => {
  const db = getDatabase();

  db.all(
    `SELECT
       feature_family,
       action,
       COUNT(*) AS total_count,
       COUNT(DISTINCT user_email) AS unique_users,
       MAX(created_at) AS last_used
     FROM feature_usage
     WHERE created_at >= datetime('now', '-7 days')
     GROUP BY feature_family, action
     ORDER BY feature_family ASC, total_count DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      const breakdown = {};
      for (const row of rows) {
        if (!breakdown[row.feature_family]) {
          breakdown[row.feature_family] = [];
        }
        breakdown[row.feature_family].push({
          action: row.action,
          totalCount: row.total_count,
          uniqueUsers: row.unique_users,
          lastUsed: row.last_used,
        });
      }

      res.json({ breakdown });
    }
  );
});

module.exports = router;
