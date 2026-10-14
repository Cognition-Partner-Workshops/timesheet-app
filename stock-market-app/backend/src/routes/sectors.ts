import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { cachedResponse } from '../utils/routeHelpers';

const router = Router();

/** GET /api/sectors — List all sectors with stock count */
router.get('/', async (_req: Request, res: Response) => {
  await cachedResponse(res, 'sectors:all', async () => {
    const result = await query(`
      SELECT s.id, s.name, s.description, s.icon_name,
             COUNT(st.id) as stock_count
      FROM sectors s
      LEFT JOIN stocks st ON st.sector_id = s.id
      GROUP BY s.id, s.name, s.description, s.icon_name
      ORDER BY s.name
    `);
    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      icon_name: row.icon_name,
      stock_count: parseInt(String(row.stock_count), 10),
    }));
  }, 'Failed to fetch sectors');
});

/** GET /api/sectors/:sectorName/top-stocks — Top N stocks for a sector */
router.get('/:sectorName/top-stocks', async (req: Request, res: Response) => {
  const { sectorName } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 50);

  await cachedResponse(res, `sectors:${sectorName}:top:${limit}`, async () => {
    const sectorResult = await query(
      'SELECT id, name, description, icon_name FROM sectors WHERE LOWER(name) = LOWER($1)',
      [sectorName.replace(/-/g, ' ')]
    );
    if (sectorResult.rows.length === 0) {
      res.status(404).json({ error: `Sector "${sectorName}" not found`, code: 404 });
      return null;
    }
    const sector = sectorResult.rows[0];
    const stocksResult = await query(
      `SELECT id, symbol, company_name, current_price, previous_close,
              day_change_pct, volume, avg_volume, pe_ratio, rsi_14,
              composite_score, score_breakdown, market_cap, eps,
              eps_growth_yoy, dividend_yield, beta,
              fifty_two_week_high, fifty_two_week_low, ma_50, ma_200,
              last_updated
       FROM stocks
       WHERE sector_id = $1
       ORDER BY composite_score DESC
       LIMIT $2`,
      [sector.id, limit]
    );
    return {
      sector: { id: sector.id, name: sector.name, description: sector.description, icon_name: sector.icon_name },
      stocks: stocksResult.rows,
    };
  }, 'Failed to fetch top stocks');
});

export default router;
