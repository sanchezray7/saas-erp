export function Skeleton({ className = '', style, ...props }) {
  return <div className={`skeleton ${className}`} style={style} {...props} />
}

Skeleton.Card = function Card() {
  return (
    <div className="card">
      <div className="skeleton-card">
        <Skeleton style={{ width: '40%', height: 24 }} />
        <Skeleton style={{ width: '100%', height: 14 }} />
        <Skeleton style={{ width: '85%', height: 14 }} />
        <Skeleton style={{ width: '60%', height: 14 }} />
        <div className="skeleton-row" style={{ marginTop: 8 }}>
          <Skeleton style={{ width: 120, height: 36, borderRadius: 8 }} />
          <Skeleton style={{ width: 100, height: 36, borderRadius: 8 }} />
        </div>
      </div>
    </div>
  )
}

Skeleton.Table = function Table({ rows = 5, cols = 5 }) {
  return (
    <div className="overflow-x-auto">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0' }}>
        <div className="skeleton-row" style={{ gap: 12, padding: '0 12px' }}>
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} style={{ flex: 1, height: 14 }} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="skeleton-row" style={{ gap: 12, padding: '8px 12px' }}>
            <Skeleton style={{ flex: 1, height: 12 }} />
            <Skeleton style={{ flex: 1, height: 12 }} />
            <Skeleton style={{ flex: 1, height: 12 }} />
            <Skeleton style={{ flex: 1, height: 12 }} />
            <Skeleton style={{ flex: cols >= 5 ? 1 : 0, height: 12, display: cols >= 5 ? undefined : 'none' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
