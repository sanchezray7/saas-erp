import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Skeleton, formatMoney, MONEDA_POR_PAIS, alertError } from '@saas/core'
import { obtenerAgingAP, obtenerAgingAR } from '../data/aging'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

const BUCKET_COLORS = { a_vencer: '#10b981', vencidas_30: '#f59e0b', vencidas_60: '#f97316', vencidas_90: '#ef4444', vencidas_mas_90: '#991b1b' }
const BUCKET_LABELS = { a_vencer: 'A vencer', vencidas_30: '1-30 días', vencidas_60: '31-60 días', vencidas_90: '61-90 días', vencidas_mas_90: '90+ días' }

export function AgingPage() {
  const { activeCompanyId, pais } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'PYG'
  const [tab, setTab] = useState('ap')
  const [apData, setApData] = useState(null)
  const [arData, setArData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeCompanyId) return
    setLoading(true)
    Promise.all([
      obtenerAgingAP(activeCompanyId),
      obtenerAgingAR(activeCompanyId),
    ]).then(([ap, ar]) => {
      setApData(ap)
      setArData(ar)
    }).catch((err) => alertError('Error', err.message))
    .finally(() => setLoading(false))
  }, [activeCompanyId])

  if (loading) return <Skeleton.Card />

  const current = tab === 'ap' ? apData : arData
  const buckets = current?.buckets || {}
  const porEntidad = current?.[tab === 'ap' ? 'por_proveedor' : 'por_cliente'] || []

  const chartData = Object.entries(BUCKET_LABELS).map(([key, label]) => ({
    name: label, valor: Number(buckets[key]) || 0, fill: BUCKET_COLORS[key],
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📊 Antigüedad de saldos</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <ButtonTab active={tab === 'ap'} onClick={() => setTab('ap')}>Cuentas por Pagar</ButtonTab>
            <ButtonTab active={tab === 'ar'} onClick={() => setTab('ar')}>Cuentas por Cobrar</ButtonTab>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <KpiCard label="Total general" value={current?.total_general || 0} color="#2563eb" moneda={moneda} />
        <KpiCard label="Vencido" value={current?.total_vencido || 0} color="#dc2626" moneda={moneda} />
        <KpiCard label="Por vencer" value={current?.total_por_vencer || 0} color="#10b981" moneda={moneda} />
        <KpiCard label={tab === 'ap' ? 'Proveedores' : 'Clientes'} value={porEntidad.length} color="#6b7280" moneda={moneda} />
      </div>

      {/* Buckets chart */}
      {chartData.some((d) => d.valor > 0) && (
        <div className="card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16 }}>Distribución por antigüedad</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" tickFormatter={(v) => formatMoney(v, moneda).slice(0, 10)} />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.82rem' }} formatter={(value) => [formatMoney(value, moneda), 'Saldo']} />
              <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla por entidad */}
      <div className="card">
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>
          {tab === 'ap' ? 'Por proveedor' : 'Por cliente'}
        </h3>
        {porEntidad.length === 0 ? (
          <p className="meta" style={{ padding: 24, textAlign: 'center' }}>Sin saldos pendientes</p>
        ) : (
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>{tab === 'ap' ? 'Proveedor' : 'Cliente'}</th>
                  <th style={{ textAlign: 'right' }}>Facturas</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right', color: '#dc2626' }}>Vencido</th>
                  <th style={{ textAlign: 'right', color: '#10b981' }}>Por vencer</th>
                </tr>
              </thead>
              <tbody>
                {porEntidad.map((e) => (
                  <tr key={e.proveedor_id || e.cliente_id}>
                    <td style={{ fontWeight: 600 }}>
                      <Link to={tab === 'ap' ? `/proveedores/${e.proveedor_id}` : `/contacts/${e.cliente_id}`} className="link">
                        {e.proveedor_nombre || e.cliente_nombre || '—'}
                      </Link>
                    </td>
                    <td style={{ textAlign: 'right' }}>{e.facturas}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(e.total, moneda)}</td>
                    <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{formatMoney(e.vencido, moneda)}</td>
                    <td style={{ textAlign: 'right', color: '#10b981' }}>{formatMoney(e.por_vencer, moneda)}</td>
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

function ButtonTab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 16px', borderRadius: 6, border: active ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
      background: active ? 'var(--color-accent)' : 'transparent',
      color: active ? '#fff' : 'var(--color-text)', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem',
    }}>{children}</button>
  )
}

function KpiCard({ label, value, color, moneda }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div className="meta" style={{ fontSize: '0.72rem', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 800, color }}>{typeof value === 'number' ? formatMoney(value, moneda) : value}</div>
    </div>
  )
}
