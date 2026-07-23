import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth, Button, Skeleton, FormField, alertError, notify } from '@saas/core'
import { getOrdenTrabajo, iniciarOT, completarOT, cancelarOT, getOTMateriales, getOTTiempos, agregarMaterial, agregarTiempo } from '../data/ordenes'

const ESTADOS = {
  pendiente: '🟡 Pendiente', en_progreso: '🔵 En progreso', completada: '✅ Completada', cancelada: '❌ Cancelada',
}

export function OrdenTrabajoDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeCompanyId, user } = useAuth()
  const [ot, setOt] = useState<any>(null)
  const [materiales, setMateriales] = useState([])
  const [tiempos, setTiempos] = useState([])
  const [loading, setLoading] = useState(true)
  const [nuevoMaterial, setNuevoMaterial] = useState({ descripcion: '', cantidad: 1, precio_unitario: 0 })
  const [nuevoTiempo, setNuevoTiempo] = useState({ horas: 1, descripcion: '', fecha: new Date().toISOString().split('T')[0] })
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [o, mats, times] = await Promise.all([getOrdenTrabajo(id), getOTMateriales(id), getOTTiempos(id)])
      setOt(o); setMateriales(mats || []); setTiempos(times || [])
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleIniciar() {
    try { await iniciarOT(id); notify('OT iniciada'); load() }
    catch (err) { alertError('Error', err.message) }
  }
  async function handleCompletar() {
    try { await completarOT(id); notify('OT completada'); load() }
    catch (err) { alertError('Error', err.message) }
  }
  async function handleCancelar() {
    if (!window.confirm('¿Cancelar esta OT?')) return
    try { await cancelarOT(id); load() }
    catch (err) { alertError('Error', err.message) }
  }

  async function handleAgregarMaterial(e) {
    e.preventDefault()
    if (!nuevoMaterial.descripcion.trim()) return
    setSubmitting(true)
    try {
      await agregarMaterial(activeCompanyId, id, nuevoMaterial)
      notify('Material agregado')
      setNuevoMaterial({ descripcion: '', cantidad: 1, precio_unitario: 0 })
      load()
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  async function handleAgregarTiempo(e) {
    e.preventDefault()
    if (!nuevoTiempo.horas || nuevoTiempo.horas <= 0) return
    setSubmitting(true)
    try {
      await agregarTiempo(id, user?.id, nuevoTiempo)
      notify('Tiempo registrado')
      setNuevoTiempo({ horas: 1, descripcion: '', fecha: new Date().toISOString().split('T')[0] })
      load()
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  if (loading) return <Skeleton.Card />
  if (!ot) return <p className="meta" style={{ textAlign: 'center', padding: 32 }}>OT no encontrada</p>

  const totalMateriales = materiales.reduce((s, m) => s + (Number(m.cantidad) || 0) * (Number(m.precio_unitario) || 0), 0)
  const totalHoras = tiempos.reduce((s, t) => s + Number(t.horas), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <div>
            <h1>⚡ OT #{ot.numero}</h1>
            <p className="meta" style={{ marginTop: 4 }}>{ESTADOS[ot.estado]} · {ot.prioridad === 'urgente' ? '🔴' : ot.prioridad === 'alta' ? '🟠' : '🔵'} {ot.titulo}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {ot.estado === 'pendiente' && <Button onClick={handleIniciar}>▶️ Iniciar</Button>}
            {ot.estado === 'en_progreso' && <Button onClick={handleCompletar}>✅ Completar</Button>}
            {(ot.estado === 'pendiente' || ot.estado === 'en_progreso') && <Button onClick={handleCancelar} style={{ background: '#ef4444', color: 'white' }}>Cancelar</Button>}
            <Link to="/ordenes-trabajo" style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>← Volver</Link>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12, fontSize: '0.85rem' }}>
          <div><strong>Cliente:</strong> {ot.contacto || '—'}</div>
          <div><strong>Dirección:</strong> {ot.direccion || '—'}</div>
          <div><strong>Prioridad:</strong> {ot.prioridad}</div>
          <div><strong>Horas est.:</strong> {ot.horas_estimadas || '—'}</div>
          <div><strong>Costo est.:</strong> {ot.costo_estimado ? `$${Number(ot.costo_estimado).toLocaleString()}` : '—'}</div>
          {ot.fecha_inicio && <div><strong>Inicio:</strong> {new Date(ot.fecha_inicio).toLocaleString()}</div>}
          {ot.fecha_fin && <div><strong>Fin:</strong> {new Date(ot.fecha_fin).toLocaleString()}</div>}
        </div>
        {ot.descripcion && <p style={{ marginTop: 12, fontSize: '0.85rem' }}>{ot.descripcion}</p>}
      </div>

      {/* Materiales */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>🔩 Materiales / Repuestos</h3>
        {ot.estado === 'en_progreso' && (
          <form onSubmit={handleAgregarMaterial} style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'flex-end' }}>
            <input value={nuevoMaterial.descripcion} onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, descripcion: e.target.value })} placeholder="Descripción" style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }} required />
            <input type="number" value={nuevoMaterial.cantidad} onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, cantidad: Number(e.target.value) })} placeholder="Cant." style={{ width: 60, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }} />
            <input type="number" value={nuevoMaterial.precio_unitario} onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, precio_unitario: Number(e.target.value) })} placeholder="$" style={{ width: 80, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }} />
            <Button type="submit" size="sm" disabled={submitting}>Agregar</Button>
          </form>
        )}
        {materiales.length === 0 ? (
          <p className="meta">Sin materiales registrados.</p>
        ) : (
          <table className="table" style={{ fontSize: '0.8rem' }}>
            <thead><tr><th>Descripción</th><th style={{ textAlign: 'right' }}>Cant.</th><th style={{ textAlign: 'right' }}>Precio</th><th style={{ textAlign: 'right' }}>Subtotal</th></tr></thead>
            <tbody>
              {materiales.map((m) => (
                <tr key={m.id}>
                  <td>{m.descripcion}</td>
                  <td style={{ textAlign: 'right' }}>{Number(m.cantidad).toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>${Number(m.precio_unitario).toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${(Number(m.cantidad) * Number(m.precio_unitario)).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr style={{ fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
              <td colSpan={3} style={{ textAlign: 'right' }}>Total materiales:</td>
              <td style={{ textAlign: 'right' }}>${totalMateriales.toLocaleString()}</td>
            </tr></tfoot>
          </table>
        )}
      </div>

      {/* Tiempos */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>⏱️ Registro de horas</h3>
        {ot.estado === 'en_progreso' && (
          <form onSubmit={handleAgregarTiempo} style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'flex-end' }}>
            <input type="number" step="0.5" value={nuevoTiempo.horas} onChange={(e) => setNuevoTiempo({ ...nuevoTiempo, horas: Number(e.target.value) })} placeholder="Horas" style={{ width: 70, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }} />
            <input value={nuevoTiempo.descripcion} onChange={(e) => setNuevoTiempo({ ...nuevoTiempo, descripcion: e.target.value })} placeholder="¿Qué se hizo?" style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }} />
            <input type="date" value={nuevoTiempo.fecha} onChange={(e) => setNuevoTiempo({ ...nuevoTiempo, fecha: e.target.value })} style={{ width: 130, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }} />
            <Button type="submit" size="sm" disabled={submitting}>Registrar</Button>
          </form>
        )}
        {tiempos.length === 0 ? (
          <p className="meta">Sin horas registradas.</p>
        ) : (
          <table className="table" style={{ fontSize: '0.8rem' }}>
            <thead><tr><th>Fecha</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Horas</th></tr></thead>
            <tbody>
              {tiempos.map((t) => (
                <tr key={t.id}>
                  <td className="meta">{t.fecha}</td>
                  <td>{t.descripcion || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{Number(t.horas).toLocaleString()}h</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr style={{ fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
              <td colSpan={2} style={{ textAlign: 'right' }}>Total horas:</td>
              <td style={{ textAlign: 'right' }}>{totalHoras}h</td>
            </tr></tfoot>
          </table>
        )}
      </div>

      {ot.notas_internas && (
        <div className="card"><h3 style={{ marginBottom: 8 }}>📝 Notas internas</h3><p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{ot.notas_internas}</p></div>
      )}
      {ot.notas_cliente && (
        <div className="card"><h3 style={{ marginBottom: 8 }}>🗣️ Notas al cliente</h3><p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{ot.notas_cliente}</p></div>
      )}
    </div>
  )
}
