import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { usePriceHistory } from '../hooks/usePriceHistory';
import { LoadingSkeleton } from './LoadingSkeleton';

interface PriceChartProps {
  symbol: string;
}

const RANGES = ['1d', '7d', '1m', '3m', '1y'] as const;

export function PriceChart({ symbol }: PriceChartProps) {
  const [range, setRange] = useState<string>('7d');
  const { data, isLoading, error } = usePriceHistory(symbol, range);

  if (error) {
    return <div className="chart-error">Failed to load chart data</div>;
  }

  const chartData = data?.map((d) => ({
    date: d.date,
    price: Number(d.close),
    volume: Number(d.volume),
  })) || [];

  const isPositive = chartData.length >= 2 &&
    chartData[chartData.length - 1].price >= chartData[0].price;

  return (
    <div className="price-chart">
      <div className="chart-controls">
        {RANGES.map((r) => (
          <button
            key={r}
            className={`range-btn ${range === r ? 'active' : ''}`}
            onClick={() => setRange(r)}
          >
            {r.toUpperCase()}
          </button>
        ))}
      </div>
      {isLoading ? (
        <LoadingSkeleton height={300} />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
              tickFormatter={(val) => {
                const d = new Date(val);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
              tickFormatter={(val) => `$${val.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={isPositive ? '#22c55e' : '#ef4444'}
              fill="url(#priceGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
