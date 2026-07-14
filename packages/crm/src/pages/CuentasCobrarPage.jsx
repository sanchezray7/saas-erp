import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Skeleton, formatMoney, alertError, MONEDA_POR_PAIS } from '@saas/core'
import { obtenerAgingAR } from '@saas/accounting'

export function CuentasCobrarPage() {
  const { activeCompanyId, pais } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'PYG'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeCompanyId) return
    obtenerAgingAR(activeCompanyId)
      .then(setData)
      .catch((err) => alertError('Error', err.message))
      .finally(() => setLoading(false))
  }, [activeCompanyId])

  if (loading) return <Skeleton.Card />

  const resumen = [
    { key: 'a_vencer', label: 'A vencer', color: '#059669', bg: '#ecfdf5' },
    { key: 'vencidas_30', label: 'Vencidas 1-30 días', color: '#d97706', bg: '#fffbeb' },
    { key: 'vencidas_60', label: '31-60 días', color: '#ea580c', bg: '#fff7ed' },
    { key: 'vencidas_90', label: '61-90 días', color: '#dc2626', bg: '#fef2f2' },
    { key: 'vencidas_mas_90', label: '90+ días', color: '#991b1b', bg: '#fef2f2' },
  ]

  const buckets = data?.buckets || {}
  const porCliente = data?.por_cliente || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header" style={{ margin: 0 }}>
        <h1>💰 Cuentas por Cobrar</h1>
        <p className="meta">
          Total pendiente: <strong>{formatMoney(data?.total_general || 0, moneda)}</strong>
          {' · '}Vencido: <strong style={{ color: '#dc2626' }}>{formatMoney(data?.total_vencido || 0, moneda)}</strong>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {resumen.map((card) => (
          <div key={card.key} style={{ background: card.bg, borderRadius: 'var(--radius)', padding: '16px 20px', border: `1px solid ${card.color}20` }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: card.color, marginBottom: 4 }}>
              {card.label}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: card.color }}>
              {formatMoney(buckets[card.key] || 0, moneda)}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>📋 Facturas pendientes por cliente</h3>
          <Link to="/aging" className="link" style={{ fontSize: '0.82rem' }}>Ver antigüedad detallada →</Link>
        </div>
        {porCliente.length === 0 ? (
          <p className="meta" style={{ padding: 24, textAlign: 'center' }}>No hay facturas pendientes de cobro</p>
        ) : (
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th style={{ textAlign: 'right' }}>Facturas</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right', color: '#dc2626' }}>Vencido</th>
                  <th style={{ textAlign: 'right', color: '#059669' }}>A vencer</th>
                </tr>
              </thead>
              <tbody>
                {porCliente.map((c) => (
                  <tr key={c.cliente_id}>
                    <td style={{ fontWeight: 600 }}>
                      <Link to={`/contacts/${c.cliente_id}`} className="link">
                        {c.cliente_nombre || '—'}
                      </Link>
                    </td>
                    <td style={{ textAlign: 'right' }}>{c.facturas}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(c.total, moneda)}</td>
                    <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{formatMoney(c.vencido, moneda)}</td>
                    <td style={{ textAlign: 'right', color: '#059669' }}>{formatMoney(c.por_vencer, moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
