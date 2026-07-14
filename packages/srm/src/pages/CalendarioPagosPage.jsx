import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Skeleton, formatMoney, alertError } from '@saas/core'
import { obtenerCalendarioPagos } from '../data/pagos'

export function CalendarioPagosPage() {
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeCompanyId) return
    obtenerCalendarioPagos(activeCompanyId)
      .then(setData)
      .catch((err) => alertError('Error', err.message))
      .finally(() => setLoading(false))
  }, [activeCompanyId])

  if (loading) return <Skeleton.Card />

  const resumen = data?.resumen || {}
  const facturas = data?.facturas || []

  const resumenCards = [
    { key: 'vencidas', label: 'Vencidas', color: '#dc2626', bg: '#fef2f2' },
    { key: 'dias7', label: 'Próximos 7 días', color: '#d97706', bg: '#fffbeb' },
    { key: 'dias15', label: '8 a 15 días', color: '#2563eb', bg: '#eff6ff' },
    { key: 'dias30', label: '16 a 30 días', color: '#059669', bg: '#ecfdf5' },
  ]

  function badgeStyle(dias) {
    if (dias == null || dias < 0) return { bg: '#fef2f2', color: '#dc2626', label: 'Vencida' }
    if (dias <= 7) return { bg: '#fffbeb', color: '#d97706', label: `${dias}d` }
    if (dias <= 15) return { bg: '#eff6ff', color: '#2563eb', label: `${dias}d` }
    return { bg: '#ecfdf5', color: '#059669', label: `${dias}d` }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header" style={{ margin: 0 }}>
        <h1>📅 Calendario de pagos</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {resumenCards.map((card) => (
          <div key={card.key} style={{
            background: card.bg, borderRadius: 'var(--radius)',
            padding: '16px 20px', border: `1px solid ${card.color}20`,
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: card.color, marginBottom: 4 }}>
              {card.label}
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: card.color }}>
              {formatMoney(resumen[card.key] || 0, 'PYG')}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>📋 Facturas pendientes</h3>
        {facturas.length === 0 ? (
          <p className="meta" style={{ padding: 24, textAlign: 'center' }}>No hay facturas pendientes de pago</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Factura</th>
                <th>Proveedor</th>
                <th>Total</th>
                <th>Saldo</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => {
                const badge = badgeStyle(f.dias_restantes)
                return (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.numero_factura}</td>
                    <td>{f.proveedor?.nombre || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(f.total, f.moneda)}</td>
                    <td style={{ fontWeight: 600, color: Number(f.saldo_pendiente) > 0 ? '#dc2626' : '#16a34a' }}>
                      {formatMoney(f.saldo_pendiente, f.moneda)}
                    </td>
                    <td className="meta">{f.fecha_vencimiento?.slice(0, 10) || '—'}</td>
                    <td>
                      <span className="badge" style={{ background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </td>
                    <td>
                      <Link to={`/facturas-proveedor/${f.id}`}>
                        <span className="link" style={{ fontSize: '0.82rem' }}>Ver</span>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
