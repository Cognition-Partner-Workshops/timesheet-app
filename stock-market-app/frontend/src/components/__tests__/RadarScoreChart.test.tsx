import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RadarScoreChart } from '../RadarScoreChart';
import type { ScoreBreakdown } from '../../types';

// Mock recharts to avoid canvas issues in test environment
vi.mock('recharts', () => ({
  RadarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="radar-chart">{children}</div>,
  Radar: () => <div data-testid="radar" />,
  PolarGrid: () => <div />,
  PolarAngleAxis: () => <div />,
  PolarRadiusAxis: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockBreakdown: ScoreBreakdown = {
  intraday_change: 90,
  volume_ratio: 75,
  rsi: 80,
  price_vs_ma50: 70,
  price_vs_ma200: 65,
  pe_ratio: 60,
  eps_growth: 85,
  week52_position: 72,
  market_cap: 95,
  dividend_yield: 30,
};

describe('RadarScoreChart', () => {
  test('renders chart title', () => {
    render(<RadarScoreChart breakdown={mockBreakdown} />);
    expect(screen.getByText('Score Breakdown')).toBeDefined();
  });

  test('renders radar chart component', () => {
    render(<RadarScoreChart breakdown={mockBreakdown} />);
    expect(screen.getByTestId('radar-chart')).toBeDefined();
  });
});
