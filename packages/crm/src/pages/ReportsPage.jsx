import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, Skeleton, PERMISSIONS, MONEDA_POR_PAIS, formatMoney } from '@saas/core'
import {
  obtenerResumenVentas,
  obtenerIngresosMensuales,
  obtenerActividadesPorTipo,
  obtenerTopVendedores,
  obtenerConversionEtapas,
  obtenerVelocidadVentas,
} from '../data/reports'

const MONTHS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function Bar({ value, max, color, label, children }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600 }}>{children}</span>
      </div>
      <div style={{ background: 'var(--border)', borderRadius: 6, height: 20, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color || 'var(--accent)', borderRadius: 6, transition: 'width .4s ease' }} />
      </div>
    </div>
  )
}

function MiniBar({ value, max, label }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, marginBottom: 2 }}>{value.toLocaleString()}</div>
      <div style={{ width: '100%', height: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div style={{ width: '60%', height: `${pct}%`, background: 'var(--accent)', borderRadius: '4px 4px 0 0', minHeight: 4, transition: 'height .4s ease' }} />
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function StatCard({ value, label, color, suffix }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: color || 'var(--accent)' }}>
        {value}{suffix || ''}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export function ReportsPage() {
  const { t } = useTranslation()
  const { activeCompanyId, can, pais } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'USD'
  const [resumen, setResumen] = useState([])
  const [ingresos, setIngresos] = useState([])
  const [actividades, setActividades] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [conversion, setConversion] = useState([])
  const [velocidad, setVelocidad] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [r, i, a, v, c, vel] = await Promise.all([
        obtenerResumenVentas(activeCompanyId),
        obtenerIngresosMensuales(activeCompanyId),
        obtenerActividadesPorTipo(activeCompanyId),
        obtenerTopVendedores(activeCompanyId),
        obtenerConversionEtapas(activeCompanyId),
        obtenerVelocidadVentas(activeCompanyId),
      ])
      setResumen(r || [])
      setIngresos(i || [])
      setActividades(a || [])
      setVendedores(v || [])
      setConversion(c || [])
      setVelocidad(vel || {})
    } catch (err) {
      console.error('[Reports]', err)
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  if (loading) return <Skeleton.Card />

  const maxResumen = Math.max(...resumen.map((s) => s.count), 1)
  const maxIngresos = Math.max(...ingresos.map((m) => m.total), 1)
  const totalActividades = actividades.reduce((s, a) => s + a.count, 0)
  const maxConv = Math.max(...conversion.map((s) => s.count), 1)

  // Calcular tasas de conversión entre etapas consecutivas
  const convRates = conversion.map((s, i) => {
    const prev = i > 0 ? conversion[i - 1].count : null
    const rate = prev != null && prev > 0 ? Math.round((s.count / prev) * 100) : null
    return { ...s, rate }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header"><h1>{t('reports.titulo')}</h1></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Velocidad de ventas */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>⚡ Velocidad de ventas</h3>
          {velocidad && (velocidad.ganados || velocidad.perdidos || velocidad.activos) ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <StatCard value={velocidad.ganados} label="Días en ganar" color="var(--color-success)" suffix="d" />
              <StatCard value={velocidad.perdidos} label="Días en perder" color="var(--color-danger)" suffix="d" />
              <StatCard value={velocidad.activos} label="Días activos" color="var(--color-warning)" suffix="d" />
            </div>
          ) : (
            <p className="meta">{t('common.sinDatos')}</p>
          )}
        </div>

        {/* Tasa de conversión por etapa */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>🔄 Tasa de conversión</h3>
          {convRates.length === 0 ? (
            <p className="meta">{t('common.sinDatos')}</p>
          ) : convRates.map((s) => (
            <Bar key={s.stage_id} value={s.count} max={maxConv} color={s.color} label={s.stage_name}>
              {s.count} {s.rate != null ? `· ${s.rate}%` : ''}
            </Bar>
          ))}
          {convRates.length > 1 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--muted)' }}>
              {convRates.slice(1).map((s) => (
                <div key={s.stage_id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{conversion[convRates.indexOf(s) - 1]?.stage_name} → {s.stage_name}</span>
                  <span style={{ fontWeight: 600, color: s.rate >= 50 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {s.rate}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ventas por etapa (original) */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>{t('reports.ventasPorEtapa')}</h3>
          {resumen.length === 0 ? (
            <p className="meta">{t('common.sinDatos')}</p>
          ) : resumen.map((s) => (
            <Bar key={s.stage_id} value={s.count} max={maxResumen} color={s.color} label={s.stage_name}>
              {s.count} · {formatMoney(s.total_value, moneda)}
            </Bar>
          ))}
        </div>

        {/* Ingresos mensuales */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>{t('reports.ingresosMensuales')}</h3>
          {ingresos.length === 0 ? (
            <p className="meta">{t('common.sinDatos')}</p>
          ) : (
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', paddingTop: 16 }}>
              {ingresos.map((m) => (
                <MiniBar
                  key={`${m.year}-${m.month}`}
                  value={m.total}
                  max={maxIngresos}
                  label={`${MONTHS[m.month] || m.month}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Actividades por tipo */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>{t('reports.actividadesPorTipo')}</h3>
          {actividades.length === 0 ? (
            <p className="meta">{t('common.sinDatos')}</p>
          ) : actividades.map((a) => (
            <Bar key={a.type} value={a.count} max={totalActividades} label={t(`activities.tipo_${a.type}`)}>
              {a.count} ({totalActividades > 0 ? Math.round((a.count / totalActividades) * 100) : 0}%)
            </Bar>
          ))}
        </div>

        {/* Top vendedores */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>{t('reports.topVendedores')}</h3>
          {vendedores.length === 0 ? (
            <p className="meta">{t('common.sinDatos')}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('reports.vendedor')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.deals')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.total')}</th>
                </tr>
              </thead>
              <tbody>
                {vendedores.map((v) => (
                  <tr key={v.user_id}>
                    <td>{v.email || v.nombre || v.user_id.slice(0, 8)}</td>
                    <td style={{ textAlign: 'right' }}>{v.total_deals}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(v.total_value, moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
