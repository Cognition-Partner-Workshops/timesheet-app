/**
 * Composite Scoring Algorithm
 *
 * Normalizes each factor to 0–1 using min-max normalization within the sector,
 * then applies configurable weights. Final composite score is 0–100.
 *
 * Factor weights:
 *   Intraday change %   20%  — Higher positive change = higher score
 *   Volume ratio         15%  — Above-average volume = bullish signal
 *   RSI (14-day)         10%  — Peaks at RSI 50; penalizes extremes
 *   Price vs 50-day MA   10%  — Price above MA = positive signal
 *   Price vs 200-day MA  10%  — Price above MA = positive signal
 *   P/E ratio            10%  — Lower P/E relative to sector = better value
 *   EPS growth (YoY)     10%  — Higher growth = better
 *   52-week position      5%  — Closer to 52-week high = stronger momentum
 *   Market cap             5%  — Larger = more stable
 *   Dividend yield         5%  — Higher yield = bonus
 */

export interface StockData {
  id: number;
  symbol: string;
  day_change_pct: number;
  volume: number;
  avg_volume: number;
  rsi_14: number;
  current_price: number;
  ma_50: number;
  ma_200: number;
  pe_ratio: number;
  eps_growth_yoy: number;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  market_cap: number;
  dividend_yield: number;
}

export interface ScoreBreakdown {
  intraday_change: number;
  volume_ratio: number;
  rsi: number;
  price_vs_ma50: number;
  price_vs_ma200: number;
  pe_ratio: number;
  eps_growth: number;
  week52_position: number;
  market_cap: number;
  dividend_yield: number;
}

interface WeightConfig {
  intraday_change: number;
  volume_ratio: number;
  rsi: number;
  price_vs_ma50: number;
  price_vs_ma200: number;
  pe_ratio: number;
  eps_growth: number;
  week52_position: number;
  market_cap: number;
  dividend_yield: number;
}

const DEFAULT_WEIGHTS: WeightConfig = {
  intraday_change: 0.20,
  volume_ratio: 0.15,
  rsi: 0.10,
  price_vs_ma50: 0.10,
  price_vs_ma200: 0.10,
  pe_ratio: 0.10,
  eps_growth: 0.10,
  week52_position: 0.05,
  market_cap: 0.05,
  dividend_yield: 0.05,
};

/** Min-max normalize a value to [0, 1]. Returns 0.5 if min === max. */
function minMaxNormalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/** RSI scoring: peaks at 50, penalizes extremes (<30 oversold, >70 overbought) */
function scoreRsi(rsi: number): number {
  if (rsi <= 0 || rsi >= 100) return 0;
  // Bell curve peaking at 50
  return 1 - Math.abs(rsi - 50) / 50;
}

/** Calculate raw factor values for a single stock */
function calculateRawFactors(stock: StockData): Record<string, number> {
  const volumeRatio = stock.avg_volume > 0 ? stock.volume / stock.avg_volume : 1;
  const priceVsMa50 = stock.ma_50 > 0 ? (stock.current_price - stock.ma_50) / stock.ma_50 : 0;
  const priceVsMa200 = stock.ma_200 > 0 ? (stock.current_price - stock.ma_200) / stock.ma_200 : 0;

  const week52Range = stock.fifty_two_week_high - stock.fifty_two_week_low;
  const week52Position = week52Range > 0
    ? (stock.current_price - stock.fifty_two_week_low) / week52Range
    : 0.5;

  return {
    intraday_change: stock.day_change_pct,
    volume_ratio: volumeRatio,
    rsi: stock.rsi_14,
    price_vs_ma50: priceVsMa50,
    price_vs_ma200: priceVsMa200,
    pe_ratio: stock.pe_ratio,
    eps_growth: stock.eps_growth_yoy,
    week52_position: week52Position,
    market_cap: stock.market_cap,
    dividend_yield: stock.dividend_yield,
  };
}

/**
 * Calculate composite scores for all stocks within a sector.
 * Uses min-max normalization within the sector for each factor.
 */
export function calculateSectorScores(
  stocks: StockData[],
  weights: WeightConfig = DEFAULT_WEIGHTS
): Array<{ stockId: number; score: number; breakdown: ScoreBreakdown }> {
  if (stocks.length === 0) return [];

  // Calculate raw factors for all stocks
  const rawFactors = stocks.map((s) => ({
    stock: s,
    factors: calculateRawFactors(s),
  }));

  // Find min/max for each factor across the sector
  const factorNames = Object.keys(rawFactors[0].factors);
  const mins: Record<string, number> = {};
  const maxs: Record<string, number> = {};

  for (const name of factorNames) {
    const values = rawFactors.map((r) => r.factors[name]);
    mins[name] = Math.min(...values);
    maxs[name] = Math.max(...values);
  }

  // Normalize and score each stock
  return rawFactors.map(({ stock, factors }) => {
    const normalized: Record<string, number> = {};

    for (const name of factorNames) {
      if (name === 'rsi') {
        // RSI uses special scoring function, not min-max
        normalized[name] = scoreRsi(factors[name]);
      } else if (name === 'pe_ratio') {
        // Lower P/E is better — invert the normalization
        normalized[name] = 1 - minMaxNormalize(factors[name], mins[name], maxs[name]);
      } else {
        normalized[name] = minMaxNormalize(factors[name], mins[name], maxs[name]);
      }
    }

    const breakdown: ScoreBreakdown = {
      intraday_change: parseFloat((normalized.intraday_change * 100).toFixed(2)),
      volume_ratio: parseFloat((normalized.volume_ratio * 100).toFixed(2)),
      rsi: parseFloat((normalized.rsi * 100).toFixed(2)),
      price_vs_ma50: parseFloat((normalized.price_vs_ma50 * 100).toFixed(2)),
      price_vs_ma200: parseFloat((normalized.price_vs_ma200 * 100).toFixed(2)),
      pe_ratio: parseFloat((normalized.pe_ratio * 100).toFixed(2)),
      eps_growth: parseFloat((normalized.eps_growth * 100).toFixed(2)),
      week52_position: parseFloat((normalized.week52_position * 100).toFixed(2)),
      market_cap: parseFloat((normalized.market_cap * 100).toFixed(2)),
      dividend_yield: parseFloat((normalized.dividend_yield * 100).toFixed(2)),
    };

    // Weighted sum → 0 to 100
    const compositeScore = parseFloat((
      normalized.intraday_change * weights.intraday_change +
      normalized.volume_ratio * weights.volume_ratio +
      normalized.rsi * weights.rsi +
      normalized.price_vs_ma50 * weights.price_vs_ma50 +
      normalized.price_vs_ma200 * weights.price_vs_ma200 +
      normalized.pe_ratio * weights.pe_ratio +
      normalized.eps_growth * weights.eps_growth +
      normalized.week52_position * weights.week52_position +
      normalized.market_cap * weights.market_cap +
      normalized.dividend_yield * weights.dividend_yield
    ).toFixed(4)) * 100;

    return {
      stockId: stock.id,
      score: parseFloat(Math.min(100, Math.max(0, compositeScore)).toFixed(2)),
      breakdown,
    };
  });
}
