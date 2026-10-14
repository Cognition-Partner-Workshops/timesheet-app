interface RangeBarProps {
  low: number;
  high: number;
  current: number;
}

export function RangeBar({ low, high, current }: RangeBarProps) {
  const range = high - low;
  const position = range > 0 ? ((current - low) / range) * 100 : 50;
  const clampedPosition = Math.max(0, Math.min(100, position));

  return (
    <div className="range-bar">
      <div className="range-labels">
        <span className="range-low">${low.toFixed(2)}</span>
        <span className="range-high">${high.toFixed(2)}</span>
      </div>
      <div className="range-track">
        <div className="range-fill" style={{ width: `${clampedPosition}%` }} />
        <div
          className="range-marker"
          style={{ left: `${clampedPosition}%` }}
          title={`Current: $${current.toFixed(2)}`}
        />
      </div>
      <div className="range-current">Current: ${current.toFixed(2)}</div>
    </div>
  );
}
