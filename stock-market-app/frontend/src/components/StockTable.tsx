import { StockRow } from './StockRow';
import type { Stock } from '../types';

interface StockTableProps {
  stocks: Stock[];
}

export function StockTable({ stocks }: StockTableProps) {
  return (
    <div className="stock-table-wrapper">
      <table className="stock-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Ticker</th>
            <th>Company</th>
            <th>Price</th>
            <th>Change %</th>
            <th>Volume</th>
            <th>P/E</th>
            <th>RSI</th>
            <th>7D Chart</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock, index) => (
            <StockRow key={stock.symbol} stock={stock} rank={index + 1} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
