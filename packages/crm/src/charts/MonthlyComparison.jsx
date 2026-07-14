export function MonthlyComparison({ data, t }) {
  if (!data) return null

  const { currentMonth, previousMonth, change } = data
  const isUp = change >= 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)', lineHeight: 1.1 }}>
          {currentMonth}
        </span>
        <span style={{
          fontSize: '0.82rem',
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 12,
          background: isUp ? 'rgba(25,135,84,0.12)' : 'rgba(214,51,108,0.12)',
          color: isUp ? '#198754' : '#d6336c',
        }}>
          {isUp ? '↑' : '↓'} {Math.abs(change)}%
        </span>
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {t('dashboard.mesAnterior')}: <strong>{previousMonth}</strong>
      </div>
    </div>
  )
}
