import { useParams, Link } from 'react-router-dom';
import { useSectorStocks } from '../hooks/useStocks';
import { StockTable } from '../components/StockTable';
import { StockTableSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';

export function SectorDetailPage() {
  const { name } = useParams<{ name: string }>();
  const { data, isLoading, error, refetch } = useSectorStocks(name || '');

  if (error) {
    return <ErrorState message={`Failed to load sector: ${name}`} onRetry={() => refetch()} />;
  }

  return (
    <div className="sector-detail-page">
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{name}</span>
      </div>

      {isLoading ? (
        <>
          <div className="sector-header">
            <h1>{name}</h1>
          </div>
          <StockTableSkeleton />
        </>
      ) : data ? (
        <>
          <div className="sector-header">
            <h1>{data.sector.name}</h1>
            <p className="sector-description">{data.sector.description}</p>
          </div>
          <h2 className="section-title">Top 10 Stocks</h2>
          <StockTable stocks={data.stocks} />
        </>
      ) : null}
    </div>
  );
}
