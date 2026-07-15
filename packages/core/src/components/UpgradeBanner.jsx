import { planLabel, featureInfo } from '../data/plan'

export function UpgradeBanner({ featureKey, compact = false }) {
  const info = featureInfo(featureKey)
  if (!info?.plan) return null

  const targetPlan = planLabel(info.plan)

  if (compact) {
    return (
      <div style={{
        padding: '8px 12px',
        background: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: 6,
        fontSize: '0.82rem',
        color: '#92400e',
      }}>
        Disponible en <strong>{targetPlan.name}</strong> ({targetPlan.price})
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem 2rem',
      background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
      borderRadius: 12,
      border: '1px solid #f59e0b',
      textAlign: 'center',
      gap: '0.75rem',
    }}>
      <span style={{ fontSize: '2.5rem' }}>🔒</span>
      <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#92400e' }}>
        Módulo no disponible en tu plan actual
      </h3>
      <p style={{ margin: 0, fontSize: '0.9rem', color: '#b45309', maxWidth: 400 }}>
        Esta funcionalidad está disponible en el plan <strong>{targetPlan.name} ({targetPlan.price})</strong> o superior.
      </p>
    </div>
  )
}
