import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, notify, alertError, FormField, getSupabase } from '@saas/core'
import { listarOrdenes, guardarOrden } from '../data/ordenes'
import { listarRecetas } from '../data/recetas'

const ESTADOS = { programada: '🟡 Programada', en_proceso: '🔵 En proceso', completada: '✅ Completada', cancelada: '❌ Cancelada' }

export function OrdenesPage() {
  const { t } = useTranslation()
  const { activeCompanyId, user } = useAuth()
  const [ordenes, setOrdenes] = useState([])
  const [recetas, setRecetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ receta_id: '', lote: '', cantidad_planeada: 1, fecha_inicio_planeada: '', notas: '' })
  const [stockBajo, setStockBajo] = useState([])

  const load = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const [ords, recs] = await Promise.all([listarOrdenes(activeCompanyId), listarRecetas(activeCompanyId)])
      setOrdenes(ords)
      setRecetas(recs)

      // Detectar materia prima con stock bajo
      const { data: stock } = await getSupabase().from('producto_stock').select('*, producto:producto_id(id, nombre, codigo, stock_minimo, tipo)').eq('company_id', activeCompanyId).gt('cantidad', 0)
      if (stock) {
        const agrupado = {}
        stock.forEach((s) => {
          const key = s.producto_id
          if (!agrupado[key]) agrupado[key] = { producto: s.producto, total: 0, minimo: Number(s.stock_minimo) || Number(s.producto?.stock_minimo) || 0 }
          agrupado[key].total += Number(s.cantidad)
        })
        const bajos = Object.values(agrupado).filter((p) => p.minimo > 0 && p.total <= p.minimo).sort((a, b) => (a.total / a.minimo) - (b.total / b.minimo))
        setStockBajo(bajos)
      }
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await guardarOrden(activeCompanyId, user?.id, form)
      notify('Orden de producción creada')
      setShowForm(false)
      setForm({ receta_id: '', lote: '', cantidad_planeada: 1, fecha_inicio_planeada: '', notas: '' })
      load()
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  if (loading) return <Skeleton.Card />

  const pendientes = ordenes.filter((o) => o.estado === 'programada')
  const enProceso = ordenes.filter((o) => o.estado === 'en_proceso')
  const completadas = ordenes.filter((o) => o.estado === 'completada')
  const wipUnidades = enProceso.reduce((s, o) => s + Number(o.cantidad_planeada || 0), 0)
  const wipCosto = enProceso.reduce((s, o) => s + Number(o.costo_total || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>⚙️ Órdenes de producción</h1>
          <Button onClick={() => setShowForm(true)}>+ Nueva orden</Button>
        </div>

        {/* Resumen WIP */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: '0.82rem' }}>
          <div style={{ flex: 1, background: 'var(--color-surface-alt)', borderRadius: 'var(--radius)', padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{pendientes.length}</div>
            <div style={{ color: 'var(--color-text-muted)' }}>🟡 Pendientes</div>
          </div>
          <div style={{ flex: 1, background: '#eff6ff', borderRadius: 'var(--radius)', padding: 12, textAlign: 'center', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563eb' }}>{enProceso.length}</div>
            <div style={{ color: '#2563eb', fontSize: '0.85rem' }}>🔵 En proceso</div>
            {wipUnidades > 0 && <div style={{ color: '#2563eb', fontSize: '0.75rem', marginTop: 2 }}>{wipUnidades.toLocaleString()} uds · ${wipCosto.toLocaleString()}</div>}
          </div>
          <div style={{ flex: 1, background: 'var(--color-surface-alt)', borderRadius: 'var(--radius)', padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{completadas.length}</div>
            <div style={{ color: 'var(--color-text-muted)' }}>✅ Completadas</div>
          </div>
          <div style={{ flex: 1, background: 'var(--color-surface-alt)', borderRadius: 'var(--radius)', padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{ordenes.length}</div>
            <div style={{ color: 'var(--color-text-muted)' }}>📊 Total</div>
          </div>
        </div>

        {/* Alertas de stock bajo */}
        {stockBajo.length > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#dc2626', margin: 0 }}>⚠️ {stockBajo.length} producto(s) con stock bajo</h3>
              <Link to="/sugerencias-oc" style={{ fontSize: '0.8rem', color: 'var(--color-accent)' }}>Ver sugerencias →</Link>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {stockBajo.slice(0, 8).map((p) => (
                <div key={p.producto?.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', border: '1px solid #fecaca' }}>
                  <span style={{ fontWeight: 600 }}>{p.producto?.nombre}</span>
                  <span style={{ color: '#dc2626' }}>{Math.round(p.total)}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>/</span>
                  <span>{p.minimo}</span>
                </div>
              ))}
              {stockBajo.length > 8 && <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>+{stockBajo.length - 8} más</span>}
            </div>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleCreate} style={{ marginBottom: 20, padding: 16, background: 'var(--color-surface-alt)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3>Nueva orden de producción</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Receta" as="select" value={form.receta_id} onChange={(e) => {
                const r = recetas.find((r) => r.id === e.target.value)
                setForm({ ...form, receta_id: e.target.value, cantidad_planeada: r?.cantidad_producida || 1 })
              }} required>
                <option value="">Seleccionar...</option>
                {recetas.filter((r) => r.activo).map((r) => <option key={r.id} value={r.id}>{r.codigo ? `[${r.codigo}] ` : ''}{r.nombre}</option>)}
              </FormField>
              <FormField label="Lote" value={form.lote} onChange={(e) => setForm({ ...form, lote: e.target.value })} />
              <FormField label="Cantidad planeada" type="number" value={form.cantidad_planeada} onChange={(e) => setForm({ ...form, cantidad_planeada: Number(e.target.value) })} required />
              <FormField label="Fecha inicio planeada" type="date" value={form.fecha_inicio_planeada} onChange={(e) => setForm({ ...form, fecha_inicio_planeada: e.target.value })} />
            </div>
            <FormField label="Notas" as="textarea" rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" disabled={submitting}>{submitting ? 'Creando...' : 'Crear orden'}</Button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </form>
        )}

        {ordenes.length === 0 ? (
          <p className="meta" style={{ textAlign: 'center', padding: 32 }}>Sin órdenes de producción.</p>
        ) : (
          <table className="table" style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Receta</th>
                <th>Lote</th>
                <th>Planificado</th>
                <th>Producido</th>
                <th>Costo</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => (
                <tr key={o.id}>
                  <td className="meta">{o.numero}</td>
                  <td><Link to={`/ordenes-produccion/${o.id}`} style={{ fontWeight: 600 }}>{o.receta?.nombre || '—'}</Link></td>
                  <td className="meta">{o.lote || '—'}</td>
                  <td>{Number(o.cantidad_planeada).toLocaleString()}</td>
                  <td>{o.cantidad_producida ? Number(o.cantidad_producida).toLocaleString() : '—'}</td>
                  <td style={{ fontWeight: o.costo_total > 0 ? 600 : 400 }}>
                    {o.costo_total > 0 ? `$${Number(o.costo_total).toLocaleString()}` : o.estado === 'en_proceso' ? '🔄 WIP' : '—'}
                  </td>
                  <td>{ESTADOS[o.estado] || o.estado}</td>
                  <td className="meta">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
                  <td><Link to={`/ordenes-produccion/${o.id}`} className="btn-icon">👁️</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
