import { useNavigate } from 'react-router-dom';
import type { TopStock } from '../types';

interface SectorCardProps {
  stock: TopStock;
}

const SECTOR_ICONS: Record<string, string> = {
  'Technology': '\u{1F4BB}',
  'Healthcare': '\u{1F3E5}',
  'Finance': '\u{1F3E6}',
  'Energy': '\u26A1',
  'Consumer Discretionary': '\u{1F6D2}',
  'Industrials': '\u{1F3ED}',
  'Utilities': '\u{1F4A1}',
  'Materials': '\u{1F48E}',
  'Real Estate': '\u{1F3E2}',
  'Communication Services': '\u{1F4E1}',
  'Consumer Staples': '\u{1F4E6}',
};

export function SectorCard({ stock }: SectorCardProps) {
  const navigate = useNavigate();
  const isPositive = Number(stock.day_change_pct) >= 0;

  return (
    <div
      className="sector-card"
      onClick={() => navigate(`/sectors/${encodeURIComponent(stock.sector_name)}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/sectors/${encodeURIComponent(stock.sector_name)}`);
      }}
    >
      <div className="sector-card-header">
        <span className="sector-icon">{SECTOR_ICONS[stock.sector_name] || '\u{1F4CA}'}</span>
        <h3 className="sector-name">{stock.sector_name}</h3>
      </div>
      <div className="sector-card-body">
        <div className="top-stock-info">
          <span className="stock-ticker">{stock.symbol}</span>
          <span className="stock-company">{stock.company_name}</span>
        </div>
        <div className="stock-price-row">
          <span className="stock-price">${Number(stock.current_price).toFixed(2)}</span>
          <span className={`stock-change ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? '+' : ''}{Number(stock.day_change_pct).toFixed(2)}%
          </span>
        </div>
      </div>
      <div className="sector-card-footer">
        <div className="composite-score-badge">
          <svg viewBox="0 0 36 36" className="score-circle">
            <path
              className="score-circle-bg"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="score-circle-fill"
              strokeDasharray={`${Number(stock.composite_score)}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="score-value">{Math.round(Number(stock.composite_score))}</span>
        </div>
      </div>
    </div>
  );
}
