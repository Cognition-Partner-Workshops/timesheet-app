import { RangeBar } from './RangeBar';
import type { Stock } from '../types';

interface MetricsPanelProps {
  stock: Stock;
}

function formatMarketCap(cap: number): string {
  const num = Number(cap);
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

export function MetricsPanel({ stock }: MetricsPanelProps) {
  const metrics = [
    { label: 'Market Cap', value: formatMarketCap(stock.market_cap) },
    { label: 'P/E Ratio', value: Number(stock.pe_ratio).toFixed(2) },
    { label: 'EPS', value: `$${Number(stock.eps).toFixed(2)}` },
    { label: 'EPS Growth (YoY)', value: `${Number(stock.eps_growth_yoy).toFixed(1)}%` },
    { label: 'Beta', value: Number(stock.beta).toFixed(2) },
    { label: 'Dividend Yield', value: `${Number(stock.dividend_yield).toFixed(2)}%` },
    { label: 'Volume', value: Number(stock.volume).toLocaleString() },
    { label: 'Avg Volume', value: Number(stock.avg_volume).toLocaleString() },
    { label: 'RSI (14)', value: Number(stock.rsi_14).toFixed(1) },
    { label: '50-Day MA', value: `$${Number(stock.ma_50).toFixed(2)}` },
    { label: '200-Day MA', value: `$${Number(stock.ma_200).toFixed(2)}` },
  ];

  return (
    <div className="metrics-panel">
      <h3 className="panel-title">Key Metrics</h3>
      <div className="metrics-grid">
        {metrics.map((m) => (
          <div key={m.label} className="metric-item">
            <span className="metric-label">{m.label}</span>
            <span className="metric-value">{m.value}</span>
          </div>
        ))}
      </div>
      <div className="range-bar-container">
        <h4 className="range-title">52-Week Range</h4>
        <RangeBar
          low={Number(stock.fifty_two_week_low)}
          high={Number(stock.fifty_two_week_high)}
          current={Number(stock.current_price)}
        />
      </div>
    </div>
  );
}
