import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, usePlan, planLabel, getSupabase } from '@saas/core'

const QUOTA_KEYS = ['usuarios', 'productos', 'contactos', 'oportunidades', 'facturas_mes']
const QUOTA_NAMES = {
  usuarios: 'Usuarios',
  productos: 'Productos',
  contactos: 'Contactos',
  oportunidades: 'Oportunidades',
  facturas_mes: 'Facturas (este mes)',
}

export default function PlanSection() {
  const { activeCompanyId } = useAuth()
  const { plan, planInfo } = usePlan({ companyId: activeCompanyId })
  const [quotas, setQuotas] = useState([])
  const [loadingQuotas, setLoadingQuotas] = useState(true)

  useEffect(() => {
    if (!activeCompanyId) return
    setLoadingQuotas(true)
    const supabase = getSupabase()
    Promise.all(
      QUOTA_KEYS.map((key) =>
        supabase.rpc('check_quota', { p_company_id: activeCompanyId, p_quota_key: key })
      )
    ).then((results) => {
      const data = results.map((r, i) => ({
        key: QUOTA_KEYS[i],
        name: QUOTA_NAMES[QUOTA_KEYS[i]],
        current: r.data?.current ?? 0,
        max: r.data?.max ?? 0,
        remaining: r.data?.remaining ?? 0,
      }))
      setQuotas(data)
      setLoadingQuotas(false)
    }).catch(() => setLoadingQuotas(false))
  }, [activeCompanyId])

  const targetName = planLabel(plan).name
  const nextPlan = plan === 'free' ? planLabel('starter') : plan === 'starter' ? planLabel('business') : null

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Plan {targetName}</h3>
          <span style={{
            fontSize: '0.8rem', fontWeight: 600,
            background: plan === 'free' ? '#e2e8f0' : plan === 'starter' ? '#fef3c7' : '#dbeafe',
            color: plan === 'free' ? '#475569' : plan === 'starter' ? '#92400e' : '#1e40af',
            padding: '2px 10px', borderRadius: 100,
          }}>
            {planInfo.price}
          </span>
        </div>
      </div>

      {loadingQuotas ? (
        <p className="meta">Cargando cuotas...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {quotas.map((q) => (
            <div key={q.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <span>{q.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {q.max === -1 ? 'Ilimitado' : `${q.current} de ${q.max}`}
                </span>
              </div>
              {q.max !== -1 && (
                <div style={{
                  height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min((q.current / q.max) * 100, 100)}%`,
                    height: '100%',
                    background: q.remaining > 0 ? 'var(--primary)' : '#ef4444',
                    borderRadius: 4,
                    transition: 'width 0.3s',
                  }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {nextPlan && (
        <Link to="/settings/billing" style={{ textDecoration: 'none' }}>
          <div style={{
            padding: '1rem',
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: 8,
            textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#92400e' }}>
              ¿Necesitás más capacidad? Actualizá a <strong>{nextPlan.name} ({nextPlan.price})</strong>
            </p>
            <span className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              💳 Ver planes
            </span>
          </div>
        </Link>
      )}
    </div>
  )
}
