export interface Sector {
  id: number;
  name: string;
  description: string;
  icon_name: string;
  stock_count: number;
}

export interface Stock {
  id: number;
  symbol: string;
  company_name: string;
  sector_id: number;
  sector_name?: string;
  sector_description?: string;
  sector_icon?: string;
  market_cap: number;
  current_price: number;
  previous_close: number;
  day_change_pct: number;
  volume: number;
  avg_volume: number;
  pe_ratio: number;
  eps: number;
  eps_growth_yoy: number;
  dividend_yield: number;
  beta: number;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  rsi_14: number;
  ma_50: number;
  ma_200: number;
  composite_score: number;
  score_breakdown: ScoreBreakdown;
  last_updated: string;
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

export interface PriceHistory {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TopStock {
  sector_id: number;
  sector_name: string;
  icon_name: string;
  id: number;
  symbol: string;
  company_name: string;
  current_price: number;
  day_change_pct: number;
  composite_score: number;
  score_breakdown: ScoreBreakdown;
  last_updated: string;
}

export interface SectorDetail {
  sector: {
    id: number;
    name: string;
    description: string;
    icon_name: string;
  };
  stocks: Stock[];
}

export interface SearchResult {
  symbol: string;
  company_name: string;
  current_price: number;
  day_change_pct: number;
  composite_score: number;
  sector_name: string;
}

export interface DailyDigest {
  date: string;
  generated_at: string;
  top_picks: Array<{
    sector: string;
    symbol: string;
    company: string;
    price: number;
    change_pct: number;
    composite_score: number;
  }>;
}
