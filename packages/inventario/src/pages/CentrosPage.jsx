import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, ConfirmModal, PERMISSIONS, alertError, notify } from '@saas/core'
import { listarCentros, guardarCentro, eliminarCentro } from '../data/inventario'

export function CentrosPage() {
  const { activeCompanyId, can } = useAuth()
  const canEdit = can(PERMISSIONS.CONFIG_CREAR)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [editForm, setEditForm] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    try { setData(await listarCentros(activeCompanyId)) } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleSave(e) {
    e.preventDefault()
    if (!editForm.nombre) return
    try {
      await guardarCentro(activeCompanyId, editForm)
      notify(editForm.id ? 'Centro actualizado' : 'Centro creado')
      setEditForm(null)
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  async function handleDelete(id) {
    try { await eliminarCentro(id); notify('Centro eliminado'); setDeleting(null); load() }
    catch (err) { alertError('Error', err.message) }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>🏢 Centros Logísticos</h1>
        {canEdit && <Button size="sm" onClick={() => setEditForm({ nombre: '', direccion: '' })}>+ Nuevo centro</Button>}
      </div>

      {editForm && (
        <form onSubmit={handleSave} style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input className="form-input" placeholder="Nombre" value={editForm.nombre} onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))} style={{ width: 250 }} autoFocus />
          <input className="form-input" placeholder="Dirección" value={editForm.direccion} onChange={(e) => setEditForm((p) => ({ ...p, direccion: e.target.value }))} style={{ width: 300 }} />
          <Button type="submit" size="sm">Guardar</Button>
          <Button variant="ghost" size="sm" onClick={() => setEditForm(null)}>Cancelar</Button>
        </form>
      )}

      <table className="table" style={{ fontSize: '0.82rem' }}>
        <thead><tr><th>Nombre</th><th>Dirección</th><th style={{ width: 100 }}></th></tr></thead>
        <tbody>
          {data.length === 0 ? <tr><td colSpan={3} className="meta" style={{ textAlign: 'center', padding: 24 }}>Sin centros</td></tr>
          : data.map((c) => (
            <tr key={c.id}>
              <td style={{ fontWeight: 600 }}>{c.nombre}</td>
              <td className="meta">{c.direccion || '—'}</td>
              <td>
                <Link key={c.id} to={`/almacenes?centro=${c.id}`}><Button size="xs" variant="ghost">Almacenes</Button></Link>
                {canEdit && <Button size="xs" danger onClick={() => setDeleting(c.id)} style={{ marginLeft: 4 }}>✕</Button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && <ConfirmModal title="Eliminar centro" onConfirm={() => handleDelete(deleting)} onCancel={() => setDeleting(null)} />}
    </div>
  )
}
