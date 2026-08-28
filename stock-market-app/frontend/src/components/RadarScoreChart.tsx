import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer,
} from 'recharts';
import type { ScoreBreakdown } from '../types';

interface RadarScoreChartProps {
  breakdown: ScoreBreakdown;
}

const FACTOR_LABELS: Record<string, string> = {
  intraday_change: 'Intraday',
  volume_ratio: 'Volume',
  rsi: 'RSI',
  price_vs_ma50: 'vs MA50',
  price_vs_ma200: 'vs MA200',
  pe_ratio: 'P/E',
  eps_growth: 'EPS Growth',
  week52_position: '52W Pos',
  market_cap: 'Mkt Cap',
  dividend_yield: 'Dividend',
};

export function RadarScoreChart({ breakdown }: RadarScoreChartProps) {
  const data = Object.entries(breakdown).map(([key, value]) => ({
    factor: FACTOR_LABELS[key] || key,
    score: Number(value),
    fullMark: 100,
  }));

  return (
    <div className="radar-chart">
      <h3 className="chart-title">Score Breakdown</h3>
      <ResponsiveContainer width="100%" height={350}>
        <RadarChart data={data}>
          <PolarGrid stroke="var(--border-color)" />
          <PolarAngleAxis
            dataKey="factor"
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.3}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
