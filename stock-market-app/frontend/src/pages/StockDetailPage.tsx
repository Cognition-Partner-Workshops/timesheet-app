import { useParams, Link } from 'react-router-dom';
import { useStockDetail } from '../hooks/useStockDetail';
import { PriceChart } from '../components/PriceChart';
import { RadarScoreChart } from '../components/RadarScoreChart';
import { MetricsPanel } from '../components/MetricsPanel';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';

export function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const { data: stock, isLoading, error, refetch } = useStockDetail(symbol || '');

  if (error) {
    return <ErrorState message={`Failed to load stock: ${symbol}`} onRetry={() => refetch()} />;
  }

  if (isLoading) {
    return (
      <div className="stock-detail-page">
        <LoadingSkeleton height={40} width="30%" />
        <LoadingSkeleton height={300} />
        <LoadingSkeleton height={200} count={3} />
      </div>
    );
  }

  if (!stock) return null;

  const isPositive = Number(stock.day_change_pct) >= 0;

  return (
    <div className="stock-detail-page">
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span className="breadcrumb-sep">/</span>
        <Link to={`/sectors/${encodeURIComponent(stock.sector_name || '')}`}>
          {stock.sector_name}
        </Link>
        <span className="breadcrumb-sep">/</span>
        <span>{stock.symbol}</span>
      </div>

      <div className="stock-header">
        <div className="stock-title-row">
          <h1>{stock.symbol}</h1>
          <span className="company-name-large">{stock.company_name}</span>
        </div>
        <div className="stock-price-header">
          <span className="price-large">${Number(stock.current_price).toFixed(2)}</span>
          <span className={`change-large ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? '+' : ''}{Number(stock.day_change_pct).toFixed(2)}%
          </span>
        </div>
        <div className="composite-score-large">
          <span className="score-label">Composite Score</span>
          <span className="score-number">{Math.round(Number(stock.composite_score))}</span>
          <span className="score-max">/ 100</span>
        </div>
      </div>

      <div className="stock-detail-grid">
        <div className="chart-section">
          <PriceChart symbol={stock.symbol} />
        </div>

        <div className="metrics-section">
          <MetricsPanel stock={stock} />
        </div>

        {stock.score_breakdown && (
          <div className="radar-section">
            <RadarScoreChart breakdown={stock.score_breakdown} />
          </div>
        )}
      </div>
    </div>
  );
}
