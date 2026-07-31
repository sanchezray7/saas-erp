import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getSupabase } from '../lib/supabase'
import { FEATURES } from '../data/planConfig'
import { PATH_FEATURES } from '../data/pathContext'

const FEATURE_NAMES = {
  srm: { name: 'Starter', price: '$29/mes' },
  inventario: { name: 'Starter', price: '$29/mes' },
  contabilidad: { name: 'Starter', price: '$29/mes' },
  contabilidad_avanzada: { name: 'Business', price: '$79/mes' },
  notas_cd: { name: 'Starter', price: '$29/mes' },
  rrhh: { name: 'Business', price: '$79/mes' },
  nomina: { name: 'Business', price: '$79/mes' },
  reportes: { name: 'Starter', price: '$29/mes' },
  pos: { name: 'Starter', price: '$29/mes' },
  produccion: { name: 'Business', price: '$79/mes' },
  servicios: { name: 'Business', price: '$79/mes' },
}

function UpgradeBannerMin({ featureKey }) {
  const info = FEATURE_NAMES[featureKey]
  if (!info) return null
  return (
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
        Esta funcionalidad está disponible en el plan <strong>{info.name} ({info.price})</strong> o superior.
      </p>
      <a
        href="/settings"
        style={{
          marginTop: '0.5rem', padding: '0.6rem 1.2rem',
          background: '#6366f1', color: 'white', borderRadius: 6,
          textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
        }}
      >
        Ver planes disponibles
      </a>
    </div>
  )
}

export function PlanOutlet() {
  const { activeCompanyId } = useAuth()
  const location = useLocation()
  const [plan, setPlan] = useState('free')

  useEffect(() => {
    if (!activeCompanyId) return
    const supabase = getSupabase()
    supabase
      .from('companies')
      .select('plan')
      .eq('id', activeCompanyId)
      .single()
      .then(({ data, error }) => {
        if (!error && data?.plan) setPlan(data.plan)
      })
      .catch(() => {})
  }, [activeCompanyId])

  if (!activeCompanyId) return <Outlet />

  const match = PATH_FEATURES.find(({ prefix }) =>
    location.pathname === prefix || location.pathname.startsWith(prefix + '/')
  )

  if (match) {
    const enabled = FEATURES[match.key]?.[plan] === true
    if (!enabled) {
      return <UpgradeBannerMin featureKey={match.key} />
    }
  }

  return <Outlet />
}
