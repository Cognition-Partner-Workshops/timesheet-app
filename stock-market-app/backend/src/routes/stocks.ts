import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { cachedResponse, safeInterval } from '../utils/routeHelpers';

const router = Router();

/** GET /api/top-stocks — Best single stock from every sector */
router.get('/top-stocks', async (_req: Request, res: Response) => {
  await cachedResponse(res, 'stock:top-all', async () => {
    const result = await query(`
      SELECT DISTINCT ON (sec.id)
        sec.id as sector_id, sec.name as sector_name, sec.icon_name,
        s.id, s.symbol, s.company_name, s.current_price, s.day_change_pct,
        s.composite_score, s.score_breakdown, s.last_updated
      FROM stocks s
      JOIN sectors sec ON s.sector_id = sec.id
      ORDER BY sec.id, s.composite_score DESC
    `);
    return result.rows;
  }, 'Failed to fetch top stocks');
});

/** GET /api/stocks/:symbol — Full detail for one stock */
router.get('/stocks/:symbol', async (req: Request, res: Response) => {
  const { symbol } = req.params;
  await cachedResponse(res, `stock:detail:${symbol.toUpperCase()}`, async () => {
    const result = await query(
      `SELECT s.*, sec.name as sector_name, sec.description as sector_description,
              sec.icon_name as sector_icon
       FROM stocks s
       JOIN sectors sec ON s.sector_id = sec.id
       WHERE UPPER(s.symbol) = UPPER($1)`,
      [symbol]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: `Stock "${symbol}" not found`, code: 404 });
      return null;
    }
    return result.rows[0];
  }, 'Failed to fetch stock detail');
});

/** GET /api/stocks/:symbol/price-history — Price history with range */
router.get('/stocks/:symbol/price-history', async (req: Request, res: Response) => {
  const { symbol } = req.params;
  const range = (req.query.range as string) || '7d';
  const interval = safeInterval(range);

  await cachedResponse(res, `stock:history:${symbol.toUpperCase()}:${range}`, async () => {
    const stockResult = await query(
      'SELECT id FROM stocks WHERE UPPER(symbol) = UPPER($1)',
      [symbol]
    );
    if (stockResult.rows.length === 0) {
      res.status(404).json({ error: `Stock "${symbol}" not found`, code: 404 });
      return null;
    }
    const result = await query(
      `SELECT date, open, high, low, close, volume
       FROM price_history
       WHERE stock_id = $1 AND date >= CURRENT_DATE - $2::interval
       ORDER BY date ASC`,
      [stockResult.rows[0].id, interval]
    );
    return result.rows;
  }, 'Failed to fetch price history');
});

/** GET /api/daily-digest — Daily digest of top picks per sector */
router.get('/daily-digest', async (req: Request, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  await cachedResponse(res, `digest:${date}`, async () => {
    const result = await query(
      `SELECT DISTINCT ON (sec.id)
        sec.name as sector, s.symbol, s.company_name as company,
        s.current_price as price, s.day_change_pct as change_pct,
        sh.composite_score, s.score_breakdown
       FROM score_history sh
       JOIN stocks s ON sh.stock_id = s.id
       JOIN sectors sec ON s.sector_id = sec.id
       WHERE sh.date = $1
       ORDER BY sec.id, sh.composite_score DESC`,
      [date]
    );
    if (result.rows.length === 0) {
      const fallback = await query(
        `SELECT DISTINCT ON (sec.id)
          sec.name as sector, s.symbol, s.company_name as company,
          s.current_price as price, s.day_change_pct as change_pct,
          s.composite_score, s.score_breakdown
         FROM stocks s
         JOIN sectors sec ON s.sector_id = sec.id
         ORDER BY sec.id, s.composite_score DESC`
      );
      return { date, generated_at: new Date().toISOString(), top_picks: fallback.rows };
    }
    return { date, generated_at: new Date().toISOString(), top_picks: result.rows };
  }, 'Failed to generate daily digest');
});

export default router;
