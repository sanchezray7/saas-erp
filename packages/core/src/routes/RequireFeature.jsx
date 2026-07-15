import { useAuth } from '../auth/useAuth'

const FEATURES = {
  catalogo: { free: true, starter: true, business: true },
  crm: { free: true, starter: true, business: true },
  facturacion: { free: true, starter: true, business: true },
  notas_cd: { free: false, starter: true, business: true },
  srm: { free: false, starter: true, business: true },
  inventario: { free: false, starter: true, business: true },
  contabilidad: { free: false, starter: true, business: false },
  contabilidad_avanzada: { free: false, starter: false, business: true },
  asientos_automaticos_facturas: { free: false, starter: true, business: true },
  asientos_automaticos_nomina: { free: false, starter: false, business: true },
  rrhh: { free: false, starter: false, business: true },
  nomina: { free: false, starter: false, business: true },
  whatsapp: { free: false, starter: false, business: true },
  reportes: { free: false, starter: true, business: false },
  reportes_avanzados: { free: false, starter: false, business: true },
}

export function RequireFeature({ featureKey, children }) {
  const { activeCompanyId, companies } = useAuth()

  if (!activeCompanyId) return null

  const company = companies.find((c) => c.id === activeCompanyId)
  const plan = company?.plan || 'free'
  const enabled = FEATURES[featureKey]?.[plan] === true

  if (!enabled) {
    return (
      <div style={{ padding: '2rem', maxWidth: 480, margin: '0 auto' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '3rem 2rem',
          background: '#fef3c7', border: '1px solid #f59e0b',
          borderRadius: 12, textAlign: 'center', gap: '0.75rem',
        }}>
          <span style={{ fontSize: '2.5rem' }}>🔒</span>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#92400e' }}>
            Módulo no disponible en tu plan actual
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#b45309', maxWidth: 400 }}>
            Esta funcionalidad está disponible en el plan <strong>Business ($79/mes)</strong> o superior.
          </p>
        </div>
      </div>
    )
  }

  return children
}
