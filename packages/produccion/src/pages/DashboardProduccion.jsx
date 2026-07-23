import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Skeleton } from '@saas/core'
import { listarOrdenes } from '../data/ordenes'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function DashboardProduccion() {
  const { activeCompanyId } = useAuth()
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try { setOrdenes(await listarOrdenes(activeCompanyId)) }
    catch { /* ignore */ }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  if (loading) return <Skeleton.Card />

  const completadas = ordenes.filter((o) => o.estado === 'completada')
  const enProceso = ordenes.filter((o) => o.estado === 'en_proceso')
  const canceladas = ordenes.filter((o) => o.estado === 'cancelada')

  // Últimos 30 días
  const ahora = new Date()
  const hace30 = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000)
  const ultimas30 = completadas.filter((o) => new Date(o.created_at) >= hace30)

  const totalProducido = completadas.reduce((s, o) => s + Number(o.cantidad_producida || 0), 0)
  const costoTotal = completadas.reduce((s, o) => s + Number(o.costo_total || 0), 0)
  const costoPromedio = totalProducido > 0 ? costoTotal / totalProducido : 0

  // Merma total (consumos de órdenes completadas vs planeado)
  // Estimación simple: asumimos 5% de merma si hay ingredientes con merma_porcentaje en la receta
  const ordenesConCosto = completadas.filter((o) => o.costo_total > 0)
  const tasaExito = ordenes.length > 0 ? (completadas.length / ordenes.length * 100) : 0

  // Producción por mes (últimos 6)
  const meses = []
  for (let i = 5; i >= 0; i--) {
    const m = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    const label = MESES[m.getMonth()]
    const total = completadas.filter((o) => {
      const d = new Date(o.created_at)
      return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear()
    }).reduce((s, o) => s + Number(o.cantidad_producida || 0), 0)
    meses.push({ label, total, max: 0 })
  }
  const maxMes = Math.max(...meses.map((m) => m.total), 1)
  meses.forEach((m) => { m.max = maxMes })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Órdenes completadas</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{completadas.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            {ultimas30.length} en últimos 30 días
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Unidades producidas</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{totalProducido.toLocaleString()}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Costo promedio / unidad</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>${costoPromedio.toLocaleString()}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Tasa de completitud</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{tasaExito.toFixed(0)}%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            {enProceso.length} en proceso · {canceladas.length} canceladas
          </div>
        </div>
      </div>

      {/* Gráfico de producción mensual */}
      <div className="card">
        <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>📊 Producción mensual (unidades)</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 120, padding: '0 4px' }}>
          {meses.map((m) => (
            <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{
                width: '100%', maxWidth: 40, background: '#3b82f6', borderRadius: '4px 4px 0 0',
                height: m.max > 0 ? `${(m.total / m.max) * 100}%` : '4px', minHeight: m.total > 0 ? 16 : 4,
                transition: 'height 0.3s',
              }} />
              <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{m.label}</div>
              <div style={{ fontSize: '0.65rem', fontWeight: 600 }}>{m.total.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Últimas órdenes */}
      <div className="card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.9rem', margin: 0 }}>🕐 Últimas órdenes</h3>
          <Link to="/ordenes-produccion" style={{ fontSize: '0.82rem', color: 'var(--color-accent)' }}>Ver todas →</Link>
        </div>
        <table className="table" style={{ fontSize: '0.8rem' }}>
          <thead><tr><th>#</th><th>Receta</th><th>Producido</th><th>Costo</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>
            {ordenes.slice(0, 10).map((o) => (
              <tr key={o.id}>
                <td className="meta">{o.numero}</td>
                <td><Link to={`/ordenes-produccion/${o.id}`} style={{ fontWeight: 600 }}>{o.receta?.nombre || '—'}</Link></td>
                <td>{o.cantidad_producida ? Number(o.cantidad_producida).toLocaleString() : '—'}</td>
                <td>{o.costo_total > 0 ? `$${Number(o.costo_total).toLocaleString()}` : '—'}</td>
                <td>{o.estado === 'completada' ? '✅' : o.estado === 'en_proceso' ? '🔵' : o.estado === 'cancelada' ? '❌' : '🟡'}</td>
                <td className="meta">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
