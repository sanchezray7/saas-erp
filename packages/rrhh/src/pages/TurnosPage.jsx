import { useEffect, useState } from 'react'
import { useAuth, Button, Skeleton, alertError, notify, PERMISSIONS } from '@saas/core'
import { listarTurnos, guardarTurno, eliminarTurno } from '../data/turnos'

export function TurnosPage() {
  const { activeCompanyId, can } = useAuth()
  const puedeEditar = can(PERMISSIONS.CONFIG_CREAR)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ codigo: '', nombre: '', hora_entrada: '', hora_salida: '', tolerancia_min: 15, es_nocturno: false, color: '#3b82f6', horas_legales: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    listarTurnos(activeCompanyId).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [activeCompanyId])

  function resetForm() { setForm({ codigo: '', nombre: '', hora_entrada: '', hora_salida: '', tolerancia_min: 15, es_nocturno: false, color: '#3b82f6', horas_legales: '' }); setEditId(null) }

  async function handleSave() {
    if (!form.codigo || !form.nombre || !form.hora_entrada || !form.hora_salida) { alertError('Error', 'Completá todos los campos'); return }
    setSubmitting(true)
    try {
      await guardarTurno(activeCompanyId, editId ? { ...form, id: editId } : form)
      notify(editId ? 'Turno actualizado' : 'Turno creado')
      resetForm(); setData(await listarTurnos(activeCompanyId))
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>⚙️ Turnos</h1>
        </div>

        {puedeEditar && (
          <form onSubmit={(e) => e.preventDefault()} style={{ marginBottom: 16, padding: 16, background: '#f9fafb', borderRadius: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
              <div><div className="form-label">Código</div><input className="form-input" value={form.codigo} onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))} placeholder="M" style={{ width: '100%', fontSize: '0.82rem' }} /></div>
              <div><div className="form-label">Nombre</div><input className="form-input" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Mañana" style={{ width: '100%', fontSize: '0.82rem' }} /></div>
              <div><div className="form-label">Entrada</div><input className="form-input" type="time" value={form.hora_entrada} onChange={(e) => setForm((p) => ({ ...p, hora_entrada: e.target.value }))} style={{ width: '100%', fontSize: '0.82rem' }} /></div>
              <div><div className="form-label">Salida</div><input className="form-input" type="time" value={form.hora_salida} onChange={(e) => setForm((p) => ({ ...p, hora_salida: e.target.value }))} style={{ width: '100%', fontSize: '0.82rem' }} /></div>
              <div><div className="form-label">Tolerancia</div><input className="form-input" type="number" min="0" value={form.tolerancia_min} onChange={(e) => setForm((p) => ({ ...p, tolerancia_min: Number(e.target.value) }))} style={{ width: '100%', fontSize: '0.82rem' }} /></div>
              <div><div className="form-label">Color</div><input type="color" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} style={{ width: '100%', height: 36, cursor: 'pointer', border: 'none', padding: 0 }} /></div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, paddingBottom: 2 }}>
                <input type="checkbox" checked={form.es_nocturno} onChange={(e) => setForm((p) => ({ ...p, es_nocturno: e.target.checked }))} id="nocturno" style={{ width: 18, height: 18 }} />
                <label htmlFor="nocturno" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Nocturno</label>
              </div>
              <div><div className="form-label">Hs legales</div><input className="form-input" type="number" step="0.1" min="0" value={form.horas_legales} onChange={(e) => setForm((p) => ({ ...p, horas_legales: e.target.value }))} placeholder="Ej: 7" style={{ width: '100%', fontSize: '0.82rem' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button size="sm" type="submit" onClick={handleSave} disabled={submitting}>{submitting ? '...' : editId ? 'Actualizar' : 'Crear'}</Button>
              {editId && <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>}
            </div>
          </form>
        )}

        {data.length === 0 ? <p className="meta">Sin turnos configurados</p> : (
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead><tr><th>Código</th><th>Nombre</th><th>Entrada</th><th>Salida</th><th>Nocturno</th><th>Hs legales</th><th>Color</th><th></th></tr></thead>
              <tbody>
                {data.map((t) => (
                  <tr key={t.id}>
                    <td data-label="Código" style={{ fontWeight: 600, fontFamily: 'monospace' }}>{t.codigo}</td>
                    <td data-label="Nombre">{t.nombre}</td>
                    <td data-label="Entrada">{t.hora_entrada?.slice(0, 5)}</td>
                    <td data-label="Salida">{t.hora_salida?.slice(0, 5)}</td>
                    <td data-label="Nocturno">{t.es_nocturno ? '✅' : '—'}</td>
                    <td data-label="Hs legales">{t.horas_legales ? `${t.horas_legales}h` : '—'}</td>
                    <td data-label="Color"><span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: 4, background: t.color, verticalAlign: 'middle' }} /></td>
                    <td>{puedeEditar && <button onClick={() => { setEditId(t.id); setForm(t) }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.82rem' }}>Editar</button>}</td>
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
