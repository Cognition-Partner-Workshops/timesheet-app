import axios from 'axios';
import { config } from '../config';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { secureRandom, randomFloat } from '../utils/random';

/**
 * Data fetcher service: retrieves live stock data from Twelve Data (primary,
 * free tier with demo key), with Alpha Vantage as secondary option.
 * Includes mock data generation for offline/demo mode.
 *
 * Twelve Data free tier: 8 requests/min with demo key.
 * Get your own free key at https://twelvedata.com for higher limits (800/day).
 */

const TWELVE_DATA_BASE = 'https://api.twelvedata.com';

/** Rate limiter: tracks API calls per minute to stay within free tier limits */
let apiCallsThisMinute = 0;
let minuteWindowStart = Date.now();
const MAX_CALLS_PER_MINUTE = 7; // stay under the 8 limit

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  if (now - minuteWindowStart >= 60000) {
    apiCallsThisMinute = 0;
    minuteWindowStart = now;
  }

  if (apiCallsThisMinute >= MAX_CALLS_PER_MINUTE) {
    const waitMs = 60000 - (now - minuteWindowStart) + 1000;
    logger.info(`Rate limit reached (${apiCallsThisMinute}/${MAX_CALLS_PER_MINUTE}), waiting ${Math.ceil(waitMs / 1000)}s...`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    apiCallsThisMinute = 0;
    minuteWindowStart = Date.now();
  }
}

interface StockQuote {
  symbol: string;
  current_price: number;
  previous_close: number;
  day_change_pct: number;
  volume: number;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
}

interface TechnicalIndicators {
  rsi_14: number;
  ma_50: number;
  ma_200: number;
}

/** Fetch quote from Twelve Data (1 API credit per call) */
async function fetchTwelveDataQuote(symbol: string): Promise<StockQuote | null> {
  const apiKey = config.stockApi.twelveDataKey || 'demo';
  try {
    await waitForRateLimit();

    const response = await axios.get(`${TWELVE_DATA_BASE}/quote`, {
      params: { symbol, apikey: apiKey },
      timeout: 10000,
    });
    apiCallsThisMinute++;

    const data = response.data;
    if (data.status === 'error' || !data.close) {
      if (data.code === 429) {
        logger.warn(`Rate limited on ${symbol}, will retry next cycle`);
      } else {
        logger.warn(`Twelve Data: no data for ${symbol}: ${data.message || 'unknown'}`);
      }
      return null;
    }

    return {
      symbol,
      current_price: parseFloat(data.close),
      previous_close: parseFloat(data.previous_close),
      day_change_pct: parseFloat(data.percent_change),
      volume: parseInt(data.volume, 10) || 0,
      fifty_two_week_high: data.fifty_two_week?.high ? parseFloat(data.fifty_two_week.high) : 0,
      fifty_two_week_low: data.fifty_two_week?.low ? parseFloat(data.fifty_two_week.low) : 0,
    };
  } catch (err) {
    logger.warn(`Twelve Data quote failed for ${symbol}: ${(err as Error).message}`);
    return null;
  }
}

/** Fetch time series and compute RSI/SMA locally (1 API credit) */
async function fetchTwelveDataIndicators(symbol: string): Promise<TechnicalIndicators | null> {
  const apiKey = config.stockApi.twelveDataKey || 'demo';
  try {
    await waitForRateLimit();

    const response = await axios.get(`${TWELVE_DATA_BASE}/time_series`, {
      params: { symbol, interval: '1day', outputsize: 210, apikey: apiKey },
      timeout: 15000,
    });
    apiCallsThisMinute++;

    const data = response.data;
    if (data.status === 'error' || !data.values || data.values.length < 14) {
      return null;
    }

    // Values are newest-first; reverse for chronological order
    const closes: number[] = data.values
      .map((v: { close: string }) => parseFloat(v.close))
      .reverse();

    const rsi14 = calculateRSI(closes, 14);
    const ma50 = closes.length >= 50
      ? closes.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50
      : closes.reduce((a: number, b: number) => a + b, 0) / closes.length;
    const ma200 = closes.length >= 200
      ? closes.slice(-200).reduce((a: number, b: number) => a + b, 0) / 200
      : closes.reduce((a: number, b: number) => a + b, 0) / closes.length;

    return {
      rsi_14: parseFloat(rsi14.toFixed(2)),
      ma_50: parseFloat(ma50.toFixed(2)),
      ma_200: parseFloat(ma200.toFixed(2)),
    };
  } catch (err) {
    logger.warn(`Twelve Data time_series failed for ${symbol}: ${(err as Error).message}`);
    return null;
  }
}

/** RSI calculation from closing prices */
function calculateRSI(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Fetch quote from Alpha Vantage with exponential backoff retry (secondary) */
async function fetchAlphaVantageQuote(symbol: string): Promise<StockQuote | null> {
  if (!config.stockApi.key) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await axios.get(config.stockApi.baseUrl, {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol,
          apikey: config.stockApi.key,
        },
        timeout: 10000,
      });

      const data = response.data['Global Quote'];
      if (!data || Object.keys(data).length === 0) {
        logger.warn(`No data returned for ${symbol} from Alpha Vantage`);
        return null;
      }

      const price = parseFloat(data['05. price']);
      const prevClose = parseFloat(data['08. previous close']);

      return {
        symbol,
        current_price: price,
        previous_close: prevClose,
        day_change_pct: parseFloat(data['10. change percent']?.replace('%', '') || '0'),
        volume: parseInt(data['06. volume'], 10),
        fifty_two_week_high: 0,
        fifty_two_week_low: 0,
      };
    } catch (err) {
      const delay = Math.pow(2, attempt) * 1000;
      logger.warn(`Alpha Vantage request failed for ${symbol}, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return null;
}

/** Generate realistic mock data updates for demo mode */
export function generateMockUpdate(currentPrice: number, avgVolume: number) {
  const changePercent = (secureRandom() - 0.45) * 4;
  const newPrice = currentPrice * (1 + changePercent / 100);
  const volume = Math.floor(avgVolume * (0.5 + secureRandom() * 1.5));

  return {
    current_price: parseFloat(newPrice.toFixed(4)),
    previous_close: currentPrice,
    day_change_pct: parseFloat(changePercent.toFixed(4)),
    volume,
    rsi_14: parseFloat(randomFloat(20, 80).toFixed(4)),
    ma_50: parseFloat((newPrice * randomFloat(0.97, 1.03)).toFixed(4)),
    ma_200: parseFloat((newPrice * randomFloat(0.93, 1.03)).toFixed(4)),
    eps_growth_yoy: parseFloat(randomFloat(-10, 40).toFixed(4)),
  };
}

/** Fetch and update data for a single stock */
export async function fetchStockData(symbol: string): Promise<boolean> {
  try {
    if (config.useMockData) {
      const result = await query(
        'SELECT current_price, avg_volume FROM stocks WHERE symbol = $1',
        [symbol]
      );
      if (result.rows.length === 0) return false;

      const { current_price, avg_volume } = result.rows[0];
      const update = generateMockUpdate(
        parseFloat(current_price),
        parseInt(avg_volume, 10)
      );

      await query(
        `UPDATE stocks SET
          current_price = $1, previous_close = $2, day_change_pct = $3,
          volume = $4, rsi_14 = $5, ma_50 = $6, ma_200 = $7,
          eps_growth_yoy = $8, last_updated = NOW()
        WHERE symbol = $9`,
        [
          update.current_price, update.previous_close, update.day_change_pct,
          update.volume, update.rsi_14, update.ma_50, update.ma_200,
          update.eps_growth_yoy, symbol,
        ]
      );
      return true;
    }

    // Live mode: fetch quote only (1 API call) — indicators fetched separately
    const quote = await fetchTwelveDataQuote(symbol) ?? await fetchAlphaVantageQuote(symbol);
    if (!quote) return false;

    await query(
      `UPDATE stocks SET
        current_price = $1, previous_close = $2, day_change_pct = $3,
        volume = $4, fifty_two_week_high = $5, fifty_two_week_low = $6,
        last_updated = NOW()
      WHERE symbol = $7`,
      [
        quote.current_price, quote.previous_close, quote.day_change_pct,
        quote.volume, quote.fifty_two_week_high, quote.fifty_two_week_low,
        symbol,
      ]
    );
    return true;
  } catch (err) {
    logger.error(`Failed to fetch data for ${symbol}:`, err);
    return false;
  }
}

/** Fetch and update technical indicators for a single stock (separate call) */
export async function fetchStockIndicators(symbol: string): Promise<boolean> {
  try {
    const indicators = await fetchTwelveDataIndicators(symbol);
    if (!indicators) return false;

    await query(
      `UPDATE stocks SET rsi_14 = $1, ma_50 = $2, ma_200 = $3 WHERE symbol = $4`,
      [indicators.rsi_14, indicators.ma_50, indicators.ma_200, symbol]
    );
    return true;
  } catch (err) {
    logger.error(`Failed to fetch indicators for ${symbol}:`, err);
    return false;
  }
}
