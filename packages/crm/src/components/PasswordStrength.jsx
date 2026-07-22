export const MIN_PASSWORD = 8

export const REQUIREMENTS = [
  { key: 'minLen', test: (p) => p.length >= MIN_PASSWORD },
  { key: 'upper', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', test: (p) => /[a-z]/.test(p) },
  { key: 'number', test: (p) => /\d/.test(p) },
]

export function getStrength(password) {
  const score = REQUIREMENTS.reduce((s, r) => s + (r.test(password) ? 1 : 0), 0)
  if (score <= 1) return { level: 'weak', pct: 25, color: '#ef4444' }
  if (score <= 3) return { level: 'medium', pct: 55, color: '#f59e0b' }
  return { level: 'strong', pct: 100, color: '#22c55e' }
}

const DEFAULT_LABELS = {
  minLen: `Al menos ${MIN_PASSWORD} caracteres`,
  upper: 'Una mayúscula',
  lower: 'Una minúscula',
  number: 'Un número',
  weak: 'Débil',
  medium: 'Media',
  strong: 'Fuerte',
}

export function PasswordStrength({ password, labels }) {
  const l = { ...DEFAULT_LABELS, ...labels }
  const strength = getStrength(password)
  const met = {}
  REQUIREMENTS.forEach((r) => { met[r.key] = r.test(password) })

  return (
    <div style={{ marginTop: '0.4rem', marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${strength.pct}%`, height: '100%', background: strength.color, borderRadius: 2, transition: 'width 0.2s, background 0.2s' }} />
        </div>
        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: strength.color, minWidth: 35, textAlign: 'right' }}>
          {password.length === 0 ? '' : l[strength.level]}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
        {REQUIREMENTS.map((r) => (
          <span key={r.key} style={{ fontSize: '0.72rem', color: met[r.key] ? '#22c55e' : '#9ca3af', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: '0.6rem' }}>{met[r.key] ? '✓' : '○'}</span>
            {l[r.key]}
          </span>
        ))}
      </div>
    </div>
  )
}
