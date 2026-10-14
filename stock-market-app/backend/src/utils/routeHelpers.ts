import { Response } from 'express';
import { getCached, setCache } from '../config/redis';
import { logger } from './logger';

/**
 * Wraps a route handler with caching and error handling to reduce duplication.
 * Checks Redis cache first; on miss, calls the fetcher and caches the result.
 */
export async function cachedResponse<T>(
  res: Response,
  cacheKey: string,
  fetcher: () => Promise<T>,
  errorMessage: string
): Promise<void> {
  try {
    const cached = await getCached(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }
    const data = await fetcher();
    if (data === null) return; // fetcher already sent a response (e.g. 404)
    await setCache(cacheKey, JSON.stringify(data));
    res.json(data);
  } catch (err) {
    logger.error(errorMessage, err);
    res.status(500).json({ error: errorMessage, code: 500 });
  }
}

/** Map user-supplied range to a safe, whitelisted PostgreSQL interval string */
const RANGE_TO_INTERVAL: Record<string, string> = {
  '1d': '1 day',
  '7d': '7 days',
  '1m': '1 month',
  '3m': '3 months',
  '1y': '1 year',
};

export function safeInterval(range: string): string {
  return RANGE_TO_INTERVAL[range] || '7 days';
}
