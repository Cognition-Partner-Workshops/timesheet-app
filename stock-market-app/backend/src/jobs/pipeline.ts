import cron from 'node-cron';
import { config } from '../config';
import { query } from '../config/database';
import { invalidateCache } from '../config/redis';
import { fetchStockData } from '../services/dataFetcher';
import { calculateSectorScores, StockData } from '../services/scoring';
import { logger } from '../utils/logger';

/**
 * Scheduled data pipeline:
 * - Runs every 5 minutes during US market hours (9:30 AM – 4:00 PM ET, Mon–Fri)
 * - Runs once at market close (4:00 PM ET)
 * - Fetches latest data, recalculates scores, updates DB, invalidates cache
 */

/** Check if current time is within US market hours */
function isMarketHours(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Mon-Fri, 9:30 AM to 4:00 PM ET
  return day >= 1 && day <= 5 && timeInMinutes >= 570 && timeInMinutes <= 960;
}

/** Run the full data refresh pipeline */
export async function runPipeline(): Promise<void> {
  const startTime = Date.now();
  logger.info('Starting data pipeline...');

  try {
    // Get all tracked stocks
    const stocksResult = await query(
      'SELECT symbol FROM stocks ORDER BY symbol'
    );
    const symbols = stocksResult.rows.map((r: { symbol: string }) => r.symbol);

    let updatedCount = 0;
    const errors: string[] = [];

    // Fetch data for all stocks
    // In live mode, fetch one at a time — the rate limiter inside fetchStockData handles pacing
    // In mock mode, batch for speed
    if (config.useMockData) {
      const batchSize = 5;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((symbol: string) => fetchStockData(symbol))
        );
        for (let j = 0; j < results.length; j++) {
          if (results[j].status === 'fulfilled' && (results[j] as PromiseFulfilledResult<boolean>).value) {
            updatedCount++;
          } else {
            errors.push(batch[j]);
          }
        }
        if (i + batchSize < symbols.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    } else {
      // Live mode: sequential with built-in rate limiting
      for (const symbol of symbols) {
        try {
          const success = await fetchStockData(symbol);
          if (success) updatedCount++;
          else errors.push(symbol);
        } catch {
          errors.push(symbol);
        }
      }
    }

    // Recalculate composite scores per sector
    const sectorsResult = await query('SELECT id, name FROM sectors');
    const topMovers: Array<{ sector: string; symbol: string; score: number }> = [];

    for (const sector of sectorsResult.rows) {
      const sectorStocks = await query(
        `SELECT id, symbol, day_change_pct, volume, avg_volume, rsi_14,
                current_price, ma_50, ma_200, pe_ratio, eps_growth_yoy,
                fifty_two_week_high, fifty_two_week_low, market_cap, dividend_yield
         FROM stocks WHERE sector_id = $1`,
        [sector.id]
      );

      if (sectorStocks.rows.length === 0) continue;

      const stockData: StockData[] = sectorStocks.rows.map((row: Record<string, unknown>) => ({
        id: row.id as number,
        symbol: row.symbol as string,
        day_change_pct: parseFloat(String(row.day_change_pct)) || 0,
        volume: parseInt(String(row.volume), 10) || 0,
        avg_volume: parseInt(String(row.avg_volume), 10) || 1,
        rsi_14: parseFloat(String(row.rsi_14)) || 50,
        current_price: parseFloat(String(row.current_price)) || 0,
        ma_50: parseFloat(String(row.ma_50)) || 0,
        ma_200: parseFloat(String(row.ma_200)) || 0,
        pe_ratio: parseFloat(String(row.pe_ratio)) || 0,
        eps_growth_yoy: parseFloat(String(row.eps_growth_yoy)) || 0,
        fifty_two_week_high: parseFloat(String(row.fifty_two_week_high)) || 0,
        fifty_two_week_low: parseFloat(String(row.fifty_two_week_low)) || 0,
        market_cap: parseInt(String(row.market_cap), 10) || 0,
        dividend_yield: parseFloat(String(row.dividend_yield)) || 0,
      }));

      const scores = calculateSectorScores(stockData);

      // Update stocks with new scores and rank
      const sorted = [...scores].sort((a, b) => b.score - a.score);
      for (let rank = 0; rank < sorted.length; rank++) {
        const s = sorted[rank];
        await query(
          `UPDATE stocks SET composite_score = $1, score_breakdown = $2 WHERE id = $3`,
          [s.score, JSON.stringify(s.breakdown), s.stockId]
        );

        // Insert into score_history
        await query(
          `INSERT INTO score_history (stock_id, date, composite_score, rank_in_sector)
           VALUES ($1, CURRENT_DATE, $2, $3)
           ON CONFLICT DO NOTHING`,
          [s.stockId, s.score, rank + 1]
        );
      }

      // Insert price history snapshot
      for (const stock of sectorStocks.rows) {
        await query(
          `INSERT INTO price_history (stock_id, date, open, high, low, close, volume)
           VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [
            stock.id,
            parseFloat(String(stock.current_price)),
            parseFloat(String(stock.current_price)) * 1.01,
            parseFloat(String(stock.current_price)) * 0.99,
            parseFloat(String(stock.current_price)),
            parseInt(String(stock.volume), 10),
          ]
        );
      }

      if (sorted.length > 0) {
        const topStock = stockData.find((s) => s.id === sorted[0].stockId);
        topMovers.push({
          sector: sector.name,
          symbol: topStock?.symbol || 'N/A',
          score: sorted[0].score,
        });
      }
    }

    // Invalidate Redis cache
    await invalidateCache();
    await invalidateCache('sectors:*');
    await invalidateCache('digest:*');

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`Pipeline complete: ${updatedCount}/${symbols.length} stocks updated in ${elapsed}s`);
    if (errors.length > 0) {
      logger.warn(`Failed to update: ${errors.join(', ')}`);
    }
    logger.info('Top movers by sector:');
    topMovers.forEach((m) => {
      logger.info(`  ${m.sector}: ${m.symbol} (score: ${m.score})`);
    });
  } catch (err) {
    logger.error('Pipeline failed:', err);
  }
}

/** Generate daily digest: top pick per sector for a given date */
export async function generateDailyDigest(date: string): Promise<Record<string, unknown>[]> {
  const result = await query(
    `SELECT s.symbol, s.company_name, s.composite_score, s.day_change_pct,
            s.current_price, sec.name as sector_name, s.score_breakdown
     FROM stocks s
     JOIN sectors sec ON s.sector_id = sec.id
     WHERE s.id IN (
       SELECT DISTINCT ON (sector_id) id
       FROM stocks
       ORDER BY sector_id, composite_score DESC
     )
     ORDER BY sec.name`,
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    sector: row.sector_name,
    symbol: row.symbol,
    company: row.company_name,
    price: row.current_price,
    change_pct: row.day_change_pct,
    composite_score: row.composite_score,
    score_breakdown: row.score_breakdown,
    date,
  }));
}

/** Start the scheduled cron jobs */
export function startScheduler(): void {
  // Every 5 minutes during market hours
  cron.schedule('*/5 * * * 1-5', async () => {
    if (isMarketHours()) {
      logger.info('Scheduled pipeline triggered (market hours)');
      await runPipeline();
    }
  });

  // At market close (4:00 PM ET = 21:00 UTC during EST, 20:00 UTC during EDT)
  cron.schedule('0 20,21 * * 1-5', async () => {
    logger.info('Market close pipeline triggered');
    await runPipeline();
  });

  // For demo/development: run every 5 minutes regardless of market hours
  if (process.env.USE_MOCK_DATA === 'true') {
    cron.schedule('*/5 * * * *', async () => {
      logger.info('Mock data pipeline triggered');
      await runPipeline();
    });
  }

  logger.info('Scheduler started');
}
