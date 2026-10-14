import { useTopStocks } from '../hooks/useStocks';
import { SectorCard } from '../components/SectorCard';
import { SectorCardSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';

export function LandingPage() {
  const { data: stocks, isLoading, error, refetch, dataUpdatedAt } = useTopStocks();

  const lastUpdated = dataUpdatedAt
    ? Math.round((Date.now() - dataUpdatedAt) / 60000)
    : null;

  return (
    <div className="landing-page">
      <div className="page-header">
        <h1>Market Overview</h1>
        <p className="page-subtitle">Best performing stocks by sector</p>
        {lastUpdated !== null && (
          <span className="last-updated">
            Last updated: {lastUpdated === 0 ? 'just now' : `${lastUpdated} min ago`}
          </span>
        )}
      </div>

      {error ? (
        <ErrorState message="Failed to load market data" onRetry={() => refetch()} />
      ) : (
        <div className="sector-grid">
          {isLoading
            ? Array.from({ length: 11 }).map((_, i) => <SectorCardSkeleton key={i} />)
            : stocks?.map((stock) => (
                <SectorCard key={stock.sector_name} stock={stock} />
              ))}
        </div>
      )}
    </div>
  );
}
