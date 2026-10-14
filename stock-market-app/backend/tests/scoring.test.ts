import { calculateSectorScores, StockData } from '../src/services/scoring';

function makeStock(overrides: Partial<StockData> = {}): StockData {
  return {
    id: 1,
    symbol: 'TEST',
    day_change_pct: 2.5,
    volume: 1000000,
    avg_volume: 800000,
    rsi_14: 50,
    current_price: 150,
    ma_50: 145,
    ma_200: 140,
    pe_ratio: 20,
    eps_growth_yoy: 15,
    fifty_two_week_high: 180,
    fifty_two_week_low: 100,
    market_cap: 500000000000,
    dividend_yield: 1.5,
    ...overrides,
  };
}

describe('Composite Scoring Algorithm', () => {
  test('normal case: scores multiple stocks within a sector', () => {
    const stocks: StockData[] = [
      makeStock({ id: 1, symbol: 'A', day_change_pct: 3.0, volume: 2000000 }),
      makeStock({ id: 2, symbol: 'B', day_change_pct: -1.0, volume: 500000 }),
      makeStock({ id: 3, symbol: 'C', day_change_pct: 1.0, volume: 1000000 }),
    ];

    const results = calculateSectorScores(stocks);

    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.breakdown).toBeDefined();
      expect(r.breakdown.intraday_change).toBeGreaterThanOrEqual(0);
      expect(r.breakdown.intraday_change).toBeLessThanOrEqual(100);
    });

    // Stock A should have highest score (best change % and volume)
    const stockA = results.find((r) => r.stockId === 1)!;
    const stockB = results.find((r) => r.stockId === 2)!;
    expect(stockA.score).toBeGreaterThan(stockB.score);
  });

  test('missing data fields: handles zero/null-like values', () => {
    const stocks: StockData[] = [
      makeStock({
        id: 1,
        pe_ratio: 0,
        eps_growth_yoy: 0,
        dividend_yield: 0,
        ma_50: 0,
        ma_200: 0,
      }),
      makeStock({ id: 2 }),
    ];

    const results = calculateSectorScores(stocks);
    expect(results).toHaveLength(2);
    results.forEach((r) => {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(isNaN(r.score)).toBe(false);
    });
  });

  test('zero volume: handles stocks with zero volume gracefully', () => {
    const stocks: StockData[] = [
      makeStock({ id: 1, volume: 0, avg_volume: 0 }),
      makeStock({ id: 2, volume: 1000000, avg_volume: 800000 }),
    ];

    const results = calculateSectorScores(stocks);
    expect(results).toHaveLength(2);
    results.forEach((r) => {
      expect(isNaN(r.score)).toBe(false);
      expect(r.score).toBeGreaterThanOrEqual(0);
    });
  });

  test('negative EPS: handles stocks with negative EPS growth', () => {
    const stocks: StockData[] = [
      makeStock({ id: 1, eps_growth_yoy: -30 }),
      makeStock({ id: 2, eps_growth_yoy: 20 }),
    ];

    const results = calculateSectorScores(stocks);
    const negativeEps = results.find((r) => r.stockId === 1)!;
    const positiveEps = results.find((r) => r.stockId === 2)!;

    // Positive EPS growth should score higher on that factor
    expect(positiveEps.breakdown.eps_growth).toBeGreaterThan(negativeEps.breakdown.eps_growth);
  });

  test('all stocks identical: all get the same score', () => {
    const stocks: StockData[] = [
      makeStock({ id: 1, symbol: 'A' }),
      makeStock({ id: 2, symbol: 'B' }),
      makeStock({ id: 3, symbol: 'C' }),
    ];

    const results = calculateSectorScores(stocks);
    const scores = results.map((r) => r.score);

    // All scores should be equal when all stocks are identical
    expect(scores[0]).toEqual(scores[1]);
    expect(scores[1]).toEqual(scores[2]);
  });

  test('single stock in sector: returns valid score', () => {
    const stocks: StockData[] = [makeStock({ id: 1 })];

    const results = calculateSectorScores(stocks);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBeGreaterThanOrEqual(0);
    expect(results[0].score).toBeLessThanOrEqual(100);
    expect(isNaN(results[0].score)).toBe(false);
  });

  test('empty sector: returns empty array', () => {
    const results = calculateSectorScores([]);
    expect(results).toHaveLength(0);
  });

  test('RSI scoring: peaks at 50, penalizes extremes', () => {
    const stocks: StockData[] = [
      makeStock({ id: 1, rsi_14: 50 }),  // Optimal
      makeStock({ id: 2, rsi_14: 80 }),  // Overbought
      makeStock({ id: 3, rsi_14: 20 }),  // Oversold
    ];

    const results = calculateSectorScores(stocks);
    const rsi50 = results.find((r) => r.stockId === 1)!;
    const rsi80 = results.find((r) => r.stockId === 2)!;
    const rsi20 = results.find((r) => r.stockId === 3)!;

    expect(rsi50.breakdown.rsi).toBeGreaterThan(rsi80.breakdown.rsi);
    expect(rsi50.breakdown.rsi).toBeGreaterThan(rsi20.breakdown.rsi);
  });

  test('score breakdown contains all 10 factors', () => {
    const stocks: StockData[] = [makeStock({ id: 1 }), makeStock({ id: 2 })];
    const results = calculateSectorScores(stocks);

    const breakdown = results[0].breakdown;
    expect(breakdown).toHaveProperty('intraday_change');
    expect(breakdown).toHaveProperty('volume_ratio');
    expect(breakdown).toHaveProperty('rsi');
    expect(breakdown).toHaveProperty('price_vs_ma50');
    expect(breakdown).toHaveProperty('price_vs_ma200');
    expect(breakdown).toHaveProperty('pe_ratio');
    expect(breakdown).toHaveProperty('eps_growth');
    expect(breakdown).toHaveProperty('week52_position');
    expect(breakdown).toHaveProperty('market_cap');
    expect(breakdown).toHaveProperty('dividend_yield');
  });
});
