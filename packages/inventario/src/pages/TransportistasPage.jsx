import { useEffect, useState, useCallback } from 'react'
import { useAuth, Button, Skeleton, ConfirmModal, PERMISSIONS, alertError, notify } from '@saas/core'
import { listarTransportistas, guardarTransportista, eliminarTransportista } from '../data/transportistas'

export function TransportistasPage() {
  const { activeCompanyId, can } = useAuth()
  const canEdit = can(PERMISSIONS.CONFIG_CREAR)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [editForm, setEditForm] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    try { setData(await listarTransportistas(activeCompanyId)) } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])
  useEffect(() => { load() }, [load])

  async function handleSave(e) {
    e.preventDefault()
    if (!editForm.nombre) return
    try { await guardarTransportista(activeCompanyId, editForm); notify(editForm.id ? 'Actualizado' : 'Creado'); setEditForm(null); load() }
    catch (err) { alertError('Error', err.message) }
  }
  async function handleDelete(id) {
    try { await eliminarTransportista(id); notify('Eliminado'); setDeleting(null); load() }
    catch (err) { alertError('Error', err.message) }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>🚚 Transportistas</h1>
        {canEdit && <Button size="sm" onClick={() => setEditForm({ nombre: '', ruc: '', telefono: '', contacto: '' })}>+ Nuevo transportista</Button>}
      </div>
      {editForm && (
        <form onSubmit={handleSave} style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input className="form-input" placeholder="Nombre" value={editForm.nombre} onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))} style={{ width: 180 }} autoFocus />
          <input className="form-input" placeholder="RUC" value={editForm.ruc} onChange={(e) => setEditForm((p) => ({ ...p, ruc: e.target.value }))} style={{ width: 140 }} />
          <input className="form-input" placeholder="Teléfono" value={editForm.telefono} onChange={(e) => setEditForm((p) => ({ ...p, telefono: e.target.value }))} style={{ width: 140 }} />
          <input className="form-input" placeholder="Contacto" value={editForm.contacto} onChange={(e) => setEditForm((p) => ({ ...p, contacto: e.target.value }))} style={{ width: 160 }} />
          <Button type="submit" size="sm">Guardar</Button>
          <Button variant="ghost" size="sm" onClick={() => setEditForm(null)}>Cancelar</Button>
        </form>
      )}
      <table className="table" style={{ fontSize: '0.82rem' }}>
        <thead><tr><th>Nombre</th><th>RUC</th><th>Teléfono</th><th>Contacto</th><th style={{ width: 80 }}></th></tr></thead>
        <tbody>
          {data.length === 0 ? <tr><td colSpan={5} className="meta" style={{ textAlign: 'center', padding: 24 }}>Sin transportistas</td></tr>
          : data.map((t) => (
            <tr key={t.id}>
              <td style={{ fontWeight: 600 }}>{t.nombre}</td>
              <td className="meta">{t.ruc || '—'}</td>
              <td>{t.telefono || '—'}</td>
              <td className="meta">{t.contacto || '—'}</td>
              <td>{canEdit && <Button size="xs" danger onClick={() => setDeleting(t.id)}>✕</Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {deleting && <ConfirmModal title="Eliminar transportista" onConfirm={() => handleDelete(deleting)} onCancel={() => setDeleting(null)} />}
    </div>
  )
}
