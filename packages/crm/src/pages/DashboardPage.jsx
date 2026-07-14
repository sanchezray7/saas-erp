import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Skeleton, formatMoney, MONEDA_POR_PAIS } from '@saas/core'
import { obtenerDashboard } from '../data/dashboard'
import { obtenerProgreso } from '../data/metas'
import { DealsFunnel } from '../charts/DealsFunnel'
import { MonthlyComparison } from '../charts/MonthlyComparison'
import { CashFlowLine } from '../charts/CashFlowLine'
import { listarStockGeneral } from '@saas/inventario'
import { obtenerAgingAP, obtenerAgingAR } from '@saas/accounting'

export function DashboardPage() {
  const { t } = useTranslation()
  const { activeCompanyId, pais } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'USD'
  const [data, setData] = useState(null)
  const [progreso, setProgreso] = useState([])
  const [stockBajo, setStockBajo] = useState([])
  const [aging, setAging] = useState({ ap: null, ar: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeCompanyId) return

    async function load() {
      try {
        const [result, prog, stock, apAging, arAging] = await Promise.all([
          obtenerDashboard(activeCompanyId),
          obtenerProgreso(activeCompanyId, new Date().getFullYear(), new Date().getMonth() + 1).catch(() => []),
          listarStockGeneral(activeCompanyId).catch(() => []),
          obtenerAgingAP(activeCompanyId).catch(() => null),
          obtenerAgingAR(activeCompanyId).catch(() => null),
        ])
        setData(result)
        setProgreso(prog || [])
        setAging({ ap: apAging, ar: arAging })
        // Filtrar productos con stock bajo (cantidad <= stock_minimo y stock_minimo > 0)
        const bajos = {}
        stock.forEach((s) => {
          const min = Number(s.stock_minimo) || Number(s.producto?.stock_minimo) || 0
          if (min > 0 && Number(s.cantidad) <= min) {
            const key = s.producto_id
            if (!bajos[key]) bajos[key] = { producto: s.producto, total: 0, minimo: min }
            bajos[key].total += Number(s.cantidad)
          }
        })
        setStockBajo(Object.values(bajos).sort((a, b) => (a.total / a.minimo) - (b.total / b.minimo)))
      } catch {
        // keep defaults
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [activeCompanyId])

  if (loading) return <Skeleton.Card />
  if (!data) return null

  const { kpis, funnel, monthly, projection } = data

  return (
    <div className="card">
      <div className="page-header">
        <h1>{t('dashboard.titulo')}</h1>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{kpis.openDeals}</div>
          <div className="kpi-label">{t('dashboard.dealsAbiertos')}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{kpis.wonDeals}</div>
          <div className="kpi-label">{t('dashboard.dealsGanados')}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{formatMoney(kpis.totalValue, moneda)}</div>
          <div className="kpi-label">{t('dashboard.valorTotal')}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{formatMoney(kpis.weightedForecast, moneda)}</div>
          <div className="kpi-label">{t('dashboard.pronostico')}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{kpis.contacts}</div>
          <div className="kpi-label">{t('dashboard.contactos')}</div>
        </div>
      </div>

      {progreso.length > 0 && (
        <div style={{
          marginTop: '1.25rem', padding: '0.75rem 1rem',
          background: 'var(--color-surface-alt)', borderRadius: 'var(--radius)',
          border: '1px solid var(--color-border)',
        }}>
          <h3 style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 10, color: 'var(--color-text)' }}>
            🎯 {t('metas.progresoEquipo')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {progreso.map((p) => (
              <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 500, minWidth: 100, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.nombre || p.email?.split('@')[0] || p.user_id?.slice(0, 8)}
                </span>
                <div style={{ flex: 1, height: 8, background: 'var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(p.porcentaje || 0, 100)}%`,
                    height: '100%',
                    background: p.porcentaje >= 100 ? 'var(--color-success)' : p.porcentaje >= 50 ? 'var(--color-warning)' : 'var(--color-danger)',
                    borderRadius: 4,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, minWidth: 60, textAlign: 'right' }}>
                  {p.porcentaje}%
                </span>
                <span className="meta" style={{ fontSize: '0.72rem', minWidth: 80, textAlign: 'right' }}>
                  {formatMoney(p.monto_alcanzado, moneda)} / {formatMoney(p.monto_objetivo, moneda)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stockBajo.length > 0 && (
        <div style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', background: '#fef2f2', borderRadius: 'var(--radius)', border: '1px solid #fecaca' }}>
          <div className="page-header" style={{ marginBottom: 8 }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0, color: '#dc2626' }}>⚠️ Stock bajo ({stockBajo.length})</h3>
            <Link to="/inventario" style={{ fontSize: '0.78rem' }}>Ver inventario →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stockBajo.slice(0, 6).map((s) => {
              const pct = Math.min((s.total / s.minimo) * 100, 100)
              return (
                <div key={s.producto.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                  <span style={{ fontWeight: 600, flex: 1 }}>{s.producto?.nombre || '—'}</span>
                  <div style={{ width: 80, height: 6, background: '#fecaca', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#dc2626', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontWeight: 700, color: '#dc2626', minWidth: 40, textAlign: 'right' }}>{Math.round(s.total)}</span>
                  <span className="meta" style={{ fontSize: '0.72rem' }}>/ {s.minimo}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* AP/AR widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: '1.25rem' }}>
        {aging.ap && (
          <div className="card" style={{ padding: '1rem' }}>
            <div className="page-header" style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0 }}>📊 Cuentas por Pagar</h3>
              <Link to="/aging" style={{ fontSize: '0.78rem' }}>Ver detalle →</Link>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div className="meta" style={{ fontSize: '0.7rem' }}>Total</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{formatMoney(aging.ap.total_general || 0, moneda)}</div>
              </div>
              <div>
                <div className="meta" style={{ fontSize: '0.7rem' }}>Vencido</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#dc2626' }}>{formatMoney(aging.ap.total_vencido || 0, moneda)}</div>
              </div>
              <div>
                <div className="meta" style={{ fontSize: '0.7rem' }}>A vencer</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#16a34a' }}>{formatMoney(aging.ap.total_por_vencer || 0, moneda)}</div>
              </div>
            </div>
          </div>
        )}
        {aging.ar && (
          <div className="card" style={{ padding: '1rem' }}>
            <div className="page-header" style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0 }}>📊 Cuentas por Cobrar</h3>
              <Link to="/aging" style={{ fontSize: '0.78rem' }}>Ver detalle →</Link>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div className="meta" style={{ fontSize: '0.7rem' }}>Total</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{formatMoney(aging.ar.total_general || 0, moneda)}</div>
              </div>
              <div>
                <div className="meta" style={{ fontSize: '0.7rem' }}>Vencido</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#dc2626' }}>{formatMoney(aging.ar.total_vencido || 0, moneda)}</div>
              </div>
              <div>
                <div className="meta" style={{ fontSize: '0.7rem' }}>A vencer</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#16a34a' }}>{formatMoney(aging.ar.total_por_vencer || 0, moneda)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-grid" style={{ marginTop: '1.25rem' }}>
        <div style={{ background: 'var(--surface-alt)', borderRadius: 'var(--radius)', padding: '1rem' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem', color: 'var(--text)' }}>
            {t('dashboard.funnelTitle')}
          </h3>
          <DealsFunnel data={funnel} />
        </div>
        <div style={{ background: 'var(--surface-alt)', borderRadius: 'var(--radius)', padding: '1rem' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem', color: 'var(--text)' }}>
            {t('dashboard.ganadasVsMesAnterior')}
          </h3>
          <MonthlyComparison data={monthly} t={t} />
        </div>
      </div>

      {projection.length > 0 && (
        <div style={{ marginTop: '1.25rem', background: 'var(--surface-alt)', borderRadius: 'var(--radius)', padding: '1rem' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem', color: 'var(--text)' }}>
            {t('dashboard.proyeccionFlujo')}
          </h3>
          <CashFlowLine data={projection} />
        </div>
      )}
    </div>
  )
}
