import { useEffect, useState } from 'react'
import { useAuth, Button, Skeleton, alertError, notify, PERMISSIONS } from '@saas/core'
import { listarPatrones, obtenerPatron, guardarPatron, eliminarPatron, listarTurnos } from '../data/turnos'

export function RotacionPatronesPage() {
  const { activeCompanyId, can } = useAuth()
  const puedeEditar = can(PERMISSIONS.CONFIG_CREAR)
  const [data, setData] = useState([])
  const [turnos, setTurnos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ nombre: '', descripcion: '', dias: [] })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([listarPatrones(activeCompanyId), listarTurnos(activeCompanyId)])
      .then(([p, t]) => { setData(p); setTurnos(t) }).catch(() => {}).finally(() => setLoading(false))
  }, [activeCompanyId])

  function resetForm() { setForm({ nombre: '', descripcion: '', dias: [] }); setEditId(null) }

  function addDia() { setForm((p) => ({ ...p, dias: [...p.dias, { turno_id: null }] })) }
  function removeDia(idx) { setForm((p) => ({ ...p, dias: p.dias.filter((_, i) => i !== idx) })) }
  function setDia(idx, turnoId) {
    setForm((p) => { const dias = [...p.dias]; dias[idx] = { ...dias[idx], turno_id: turnoId }; return { ...p, dias } })
  }

  async function handleEdit(id) {
    try {
      const p = await obtenerPatron(id)
      setEditId(id)
      setForm({ nombre: p.nombre, descripcion: p.descripcion || '', dias: p.dias.map((d) => ({ turno_id: d.turno_id || null })) })
    } catch (err) { alertError('Error', err.message) }
  }

  async function handleSave() {
    if (!form.nombre.trim() || form.dias.length === 0) { alertError('Error', 'Nombre y al menos 1 día requeridos'); return }
    setSubmitting(true)
    try {
      const id = editId && editId !== 'new' ? editId : null
      await guardarPatron(activeCompanyId, { ...form, id })
      notify(editId && editId !== 'new' ? 'Patrón actualizado' : 'Patrón creado'); resetForm()
      setData(await listarPatrones(activeCompanyId))
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  async function handleEliminar(id) {
    if (!window.confirm('¿Eliminar este patrón?')) return
    await eliminarPatron(id); setData(await listarPatrones(activeCompanyId))
  }

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>🔄 Patrones de rotación</h1>
        </div>

        {puedeEditar && !editId && (
          <Button size="sm" onClick={() => { setForm({ nombre: '', descripcion: '', dias: [{ turno_id: null }] }); setEditId('new') }} style={{ marginBottom: 16 }}>+ Nuevo patrón</Button>
        )}

        {editId && (
          <div style={{ marginBottom: 16, padding: 16, background: '#f9fafb', borderRadius: 8 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <input className="form-input" placeholder="Nombre (ej: 4x3 Diurno)" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} style={{ width: 200, fontSize: '0.82rem' }} />
              <input className="form-input" placeholder="Descripción (ej: 2M + 2T + 3D)" value={form.descripcion} onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} style={{ width: 250, fontSize: '0.82rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {form.dias.map((d, i) => (
                <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 8px', background: '#fff', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                  <span className="meta" style={{ fontSize: '0.7rem', marginRight: 4 }}>D{i + 1}</span>
                  <select className="form-input" value={d.turno_id || ''} onChange={(e) => setDia(i, e.target.value || null)} style={{ width: 100, fontSize: '0.78rem', padding: '2px 4px' }}>
                    <option value="">Descanso</option>
                    {turnos.map((t) => <option key={t.id} value={t.id}>{t.codigo} - {t.nombre}</option>)}
                  </select>
                  {form.dias.length > 1 && <button onClick={() => removeDia(i)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.82rem' }}>✕</button>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="sm" variant="ghost" onClick={addDia}>+ Agregar día</Button>
              <Button size="sm" onClick={handleSave} disabled={submitting}>{submitting ? '...' : '💾 Guardar patrón'}</Button>
              <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>
            </div>
          </div>
        )}

        {data.length === 0 ? <p className="meta">Sin patrones configurados</p> : (
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead><tr><th>Nombre</th><th>Descripción</th><th>Días del ciclo</th><th></th></tr></thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Nombre" style={{ fontWeight: 600 }}>{p.nombre}</td>
                    <td data-label="Descripción" className="meta">{p.descripcion || '—'}</td>
                    <td data-label="Días del ciclo" style={{ fontSize: '0.82rem' }}>{p.resumen_dias || '—'}</td>
                    <td>{puedeEditar && <><button onClick={() => handleEdit(p.id)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.82rem', marginRight: 8 }}>Editar</button><button onClick={() => handleEliminar(p.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.82rem' }}>Eliminar</button></>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
