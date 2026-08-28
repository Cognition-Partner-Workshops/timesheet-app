interface LoadingSkeletonProps {
  width?: string | number;
  height?: string | number;
  count?: number;
  className?: string;
}

export function LoadingSkeleton({ width = '100%', height = 20, count = 1, className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`skeleton-wrapper ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            width: typeof width === 'number' ? `${width}px` : width,
            height: typeof height === 'number' ? `${height}px` : height,
          }}
        />
      ))}
    </div>
  );
}

export function SectorCardSkeleton() {
  return (
    <div className="sector-card skeleton-card">
      <LoadingSkeleton height={24} width="60%" />
      <LoadingSkeleton height={16} width="80%" />
      <LoadingSkeleton height={40} width="100%" />
      <LoadingSkeleton height={50} width={50} className="skeleton-circle" />
    </div>
  );
}

export function StockTableSkeleton() {
  return (
    <div className="stock-table-skeleton">
      {Array.from({ length: 10 }).map((_, i) => (
        <LoadingSkeleton key={i} height={48} />
      ))}
    </div>
  );
}
