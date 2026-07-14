import { useEffect, useState, useCallback } from 'react'
import { useAuth, Button, Skeleton, ConfirmModal, PERMISSIONS, alertError, notify } from '@saas/core'
import { listarAlmacenes, listarUbicaciones, guardarUbicacion, eliminarUbicacion } from '../data/inventario'

export function UbicacionesPage() {
  const { activeCompanyId, can } = useAuth()
  const canEdit = can(PERMISSIONS.CONFIG_CREAR)
  const [almacenes, setAlmacenes] = useState([])
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroAlmacen, setFiltroAlmacen] = useState('')
  const [editForm, setEditForm] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    try {
      setAlmacenes(await listarAlmacenes(activeCompanyId))
      setData(await listarUbicaciones(activeCompanyId))
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  const filtered = data.filter((u) => !filtroAlmacen || u.almacen_id === filtroAlmacen)

  async function handleSave(e) {
    e.preventDefault()
    if (!editForm.nombre || !editForm.almacen_id) return
    try {
      await guardarUbicacion(activeCompanyId, editForm)
      notify(editForm.id ? 'Ubicación actualizada' : 'Ubicación creada')
      setEditForm(null)
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  async function handleDelete(id) {
    try { await eliminarUbicacion(id); notify('Ubicación eliminada'); setDeleting(null); load() }
    catch (err) { alertError('Error', err.message) }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>📍 Ubicaciones</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select className="form-input" value={filtroAlmacen} onChange={(e) => setFiltroAlmacen(e.target.value)} style={{ width: 200, fontSize: '0.82rem' }}>
          <option value="">Todos los almacenes</option>
          {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        {canEdit && <Button size="sm" onClick={() => setEditForm({ nombre: '', almacen_id: '', pasillo: '', estante: '', posicion: '' })}>+ Nueva ubicación</Button>}
      </div>

      {editForm && (
        <form onSubmit={handleSave} style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <select className="form-input" value={editForm.almacen_id} onChange={(e) => setEditForm((p) => ({ ...p, almacen_id: e.target.value }))} style={{ width: 160 }}>
            <option value="">— Almacén —</option>
            {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <input className="form-input" placeholder="Nombre" value={editForm.nombre} onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))} style={{ width: 160 }} autoFocus />
          <input className="form-input" placeholder="Pasillo" value={editForm.pasillo} onChange={(e) => setEditForm((p) => ({ ...p, pasillo: e.target.value }))} style={{ width: 100 }} />
          <input className="form-input" placeholder="Estante" value={editForm.estante} onChange={(e) => setEditForm((p) => ({ ...p, estante: e.target.value }))} style={{ width: 100 }} />
          <input className="form-input" placeholder="Posición" value={editForm.posicion} onChange={(e) => setEditForm((p) => ({ ...p, posicion: e.target.value }))} style={{ width: 100 }} />
          <Button type="submit" size="sm">Guardar</Button>
          <Button variant="ghost" size="sm" onClick={() => setEditForm(null)}>Cancelar</Button>
        </form>
      )}

      <table className="table" style={{ fontSize: '0.82rem' }}>
        <thead><tr><th>Almacén</th><th>Nombre</th><th>Pasillo</th><th>Estante</th><th>Posición</th><th style={{ width: 80 }}></th></tr></thead>
        <tbody>
          {filtered.length === 0 ? <tr><td colSpan={6} className="meta" style={{ textAlign: 'center', padding: 24 }}>Sin ubicaciones</td></tr>
          : filtered.map((u) => (
            <tr key={u.id}>
              <td className="meta">{u.almacen?.nombre || '—'}</td>
              <td style={{ fontWeight: 600 }}>{u.nombre}</td>
              <td className="meta">{u.pasillo || '—'}</td>
              <td className="meta">{u.estante || '—'}</td>
              <td className="meta">{u.posicion || '—'}</td>
              <td>{canEdit && <Button size="xs" danger onClick={() => setDeleting(u.id)}>✕</Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && <ConfirmModal title="Eliminar ubicación" onConfirm={() => handleDelete(deleting)} onCancel={() => setDeleting(null)} />}
    </div>
  )
}
