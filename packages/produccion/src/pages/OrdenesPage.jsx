import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, notify, alertError, FormField } from '@saas/core'
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

  const load = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const [ords, recs] = await Promise.all([listarOrdenes(activeCompanyId), listarRecetas(activeCompanyId)])
      setOrdenes(ords)
      setRecetas(recs)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>⚙️ Órdenes de producción</h1>
          <Button onClick={() => setShowForm(true)}>+ Nueva orden</Button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} style={{ marginBottom: 20, padding: 16, background: 'var(--bg-alt)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', cursor: 'pointer' }}>Cancelar</button>
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
