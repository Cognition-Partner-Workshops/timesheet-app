import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { usePriceHistory } from '../hooks/usePriceHistory';

interface SparklineProps {
  symbol: string;
}

export function Sparkline({ symbol }: SparklineProps) {
  const { data, isLoading } = usePriceHistory(symbol, '7d');

  if (isLoading || !data || data.length === 0) {
    return <div className="sparkline-placeholder" />;
  }

  const firstPrice = Number(data[0].close);
  const lastPrice = Number(data[data.length - 1].close);
  const isPositive = lastPrice >= firstPrice;

  return (
    <div className="sparkline" style={{ width: 80, height: 30 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="close"
            stroke={isPositive ? '#22c55e' : '#ef4444'}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
