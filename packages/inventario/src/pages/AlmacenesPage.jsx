import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, ConfirmModal, PERMISSIONS, alertError, notify } from '@saas/core'
import { listarCentros, listarAlmacenes, guardarAlmacen, eliminarAlmacen } from '../data/inventario'

const TIPOS = [
  { value: 'general', label: '📦 General' },
  { value: 'refrigerado', label: '❄️ Refrigerado' },
  { value: 'congelado', label: '🧊 Congelado' },
  { value: 'peligroso', label: '⚠️ Peligroso' },
  { value: 'cuarentena', label: '🚧 Cuarentena' },
]

export function AlmacenesPage() {
  const { activeCompanyId, can } = useAuth()
  const canEdit = can(PERMISSIONS.CONFIG_CREAR)
  const [params] = useSearchParams()
  const centroFilter = params.get('centro') || ''
  const [centros, setCentros] = useState([])
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [editForm, setEditForm] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    try {
      const c = await listarCentros(activeCompanyId)
      setCentros(c)
      setData(await listarAlmacenes(activeCompanyId))
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  const filtered = data.filter((a) => !centroFilter || a.centro_id === centroFilter)

  async function handleSave(e) {
    e.preventDefault()
    if (!editForm.nombre || !editForm.centro_id) return
    try {
      await guardarAlmacen(activeCompanyId, editForm)
      notify(editForm.id ? 'Almacén actualizado' : 'Almacén creado')
      setEditForm(null)
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  async function handleDelete(id) {
    try { await eliminarAlmacen(id); notify('Almacén eliminado'); setDeleting(null); load() }
    catch (err) { alertError('Error', err.message) }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>📦 Almacenes</h1>
        <Link to="/centros"><Button variant="ghost" size="sm">Volver a centros</Button></Link>
      </div>

      {canEdit && <Button size="sm" onClick={() => setEditForm({ nombre: '', centro_id: centros[0]?.id || '', tipo: 'general' })} style={{ marginBottom: 8 }}>+ Nuevo almacén</Button>}

      {editForm && (
        <form onSubmit={handleSave} style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <select className="form-input" value={editForm.centro_id} onChange={(e) => setEditForm((p) => ({ ...p, centro_id: e.target.value }))} style={{ width: 200 }}>
            {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <input className="form-input" placeholder="Nombre" value={editForm.nombre} onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))} style={{ width: 200 }} autoFocus />
          <select className="form-input" value={editForm.tipo} onChange={(e) => setEditForm((p) => ({ ...p, tipo: e.target.value }))} style={{ width: 160 }}>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <Button type="submit" size="sm">Guardar</Button>
          <Button variant="ghost" size="sm" onClick={() => setEditForm(null)}>Cancelar</Button>
        </form>
      )}

      <table className="table" style={{ fontSize: '0.82rem' }}>
        <thead><tr><th>Centro</th><th>Nombre</th><th>Tipo</th><th style={{ width: 80 }}></th></tr></thead>
        <tbody>
          {filtered.length === 0 ? <tr><td colSpan={4} className="meta" style={{ textAlign: 'center', padding: 24 }}>Sin almacenes</td></tr>
          : filtered.map((a) => (
            <tr key={a.id}>
              <td className="meta">{a.centro?.nombre || '—'}</td>
              <td style={{ fontWeight: 600 }}>{a.nombre}</td>
              <td><span className="badge">{TIPOS.find((t) => t.value === a.tipo)?.label || a.tipo}</span></td>
              <td>{canEdit && <Button size="xs" danger onClick={() => setDeleting(a.id)}>✕</Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && <ConfirmModal title="Eliminar almacén" onConfirm={() => handleDelete(deleting)} onCancel={() => setDeleting(null)} />}
    </div>
  )
}
