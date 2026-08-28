import type { TopStock, Stock, ScoreBreakdown } from '../../types';

const SCORE_BREAKDOWN: ScoreBreakdown = {
  intraday_change: 90, volume_ratio: 75, rsi: 80,
  price_vs_ma50: 70, price_vs_ma200: 65, pe_ratio: 60,
  eps_growth: 85, week52_position: 72, market_cap: 95, dividend_yield: 30,
};

export const MOCK_TOP_STOCK: TopStock = {
  sector_id: 1, sector_name: 'Technology', icon_name: 'cpu',
  id: 1, symbol: 'AAPL', company_name: 'Apple Inc.',
  current_price: 185.50, day_change_pct: 2.35,
  composite_score: 85, score_breakdown: SCORE_BREAKDOWN,
  last_updated: new Date().toISOString(),
};

export const MOCK_STOCKS: Stock[] = [
  {
    id: 1, symbol: 'AAPL', company_name: 'Apple Inc.', sector_id: 1,
    market_cap: 2.8e12, current_price: 185.50, previous_close: 183.0,
    day_change_pct: 1.37, volume: 55e6, avg_volume: 50e6,
    pe_ratio: 29.5, eps: 6.28, eps_growth_yoy: 12.3, dividend_yield: 0.52,
    beta: 1.28, fifty_two_week_high: 199.62, fifty_two_week_low: 124.17,
    rsi_14: 55.2, ma_50: 178.30, ma_200: 165.40, composite_score: 85,
    score_breakdown: SCORE_BREAKDOWN,
    last_updated: new Date().toISOString(),
  },
  {
    id: 2, symbol: 'MSFT', company_name: 'Microsoft Corporation', sector_id: 1,
    market_cap: 2.7e12, current_price: 405.20, previous_close: 400.0,
    day_change_pct: 1.30, volume: 22e6, avg_volume: 25e6,
    pe_ratio: 35.2, eps: 11.5, eps_growth_yoy: 18.5, dividend_yield: 0.73,
    beta: 0.89, fifty_two_week_high: 420.82, fifty_two_week_low: 275.37,
    rsi_14: 62.1, ma_50: 390.50, ma_200: 360.20, composite_score: 82,
    score_breakdown: { ...SCORE_BREAKDOWN, intraday_change: 80, volume_ratio: 60, rsi: 72 },
    last_updated: new Date().toISOString(),
  },
];
