import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

/** GET /api/search?q=query — Search stocks by ticker or company name */
router.get('/', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (q.length < 1) {
      res.json([]);
      return;
    }

    const result = await query(
      `SELECT s.symbol, s.company_name, s.current_price, s.day_change_pct,
              s.composite_score, sec.name as sector_name
       FROM stocks s
       JOIN sectors sec ON s.sector_id = sec.id
       WHERE UPPER(s.symbol) LIKE UPPER($1)
          OR UPPER(s.company_name) LIKE UPPER($1)
       ORDER BY s.composite_score DESC
       LIMIT 20`,
      [`%${q}%`]
    );

    res.json(result.rows);
  } catch (err) {
    logger.error('Error searching stocks:', err);
    res.status(500).json({ error: 'Search failed', code: 500 });
  }
});

export default router;
