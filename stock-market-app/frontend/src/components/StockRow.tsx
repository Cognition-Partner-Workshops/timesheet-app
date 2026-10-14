import { useNavigate } from 'react-router-dom';
import { Sparkline } from './Sparkline';
import type { Stock } from '../types';

interface StockRowProps {
  stock: Stock;
  rank: number;
}

export function StockRow({ stock, rank }: StockRowProps) {
  const navigate = useNavigate();
  const isPositive = Number(stock.day_change_pct) >= 0;

  return (
    <tr
      className="stock-row"
      onClick={() => navigate(`/stocks/${stock.symbol}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/stocks/${stock.symbol}`);
      }}
    >
      <td className="rank-cell">{rank}</td>
      <td className="ticker-cell">{stock.symbol}</td>
      <td className="company-cell">{stock.company_name}</td>
      <td className="price-cell">${Number(stock.current_price).toFixed(2)}</td>
      <td className={`change-cell ${isPositive ? 'positive' : 'negative'}`}>
        {isPositive ? '+' : ''}{Number(stock.day_change_pct).toFixed(2)}%
      </td>
      <td className="volume-cell">{formatVolume(Number(stock.volume))}</td>
      <td className="pe-cell">{Number(stock.pe_ratio).toFixed(1)}</td>
      <td className="rsi-cell">{Number(stock.rsi_14).toFixed(1)}</td>
      <td className="sparkline-cell">
        <Sparkline symbol={stock.symbol} />
      </td>
      <td className="score-cell">
        <span className="score-pill">{Math.round(Number(stock.composite_score))}</span>
      </td>
    </tr>
  );
}

function formatVolume(volume: number): string {
  if (volume >= 1e9) return (volume / 1e9).toFixed(1) + 'B';
  if (volume >= 1e6) return (volume / 1e6).toFixed(1) + 'M';
  if (volume >= 1e3) return (volume / 1e3).toFixed(1) + 'K';
  return volume.toString();
}
