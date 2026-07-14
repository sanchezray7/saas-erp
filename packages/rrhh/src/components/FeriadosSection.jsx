import { useEffect, useState } from 'react'
import { Button, alertError, notify, getSupabase } from '@saas/core'
import { listarFeriados, guardarFeriado, actualizarFeriado, eliminarFeriado, seedFeriadosPY } from '../data/feriados'

export function FeriadosSection({ companyId, canEdit, pais }) {
  const [data, setData] = useState([])
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [form, setForm] = useState({ fecha: '', nombre: '' })
  const [editId, setEditId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    listarFeriados(companyId, anio).then(setData).catch(() => {})
  }, [companyId, anio])

  function resetForm() { setForm({ fecha: '', nombre: '' }); setEditId(null) }

  async function handleSave() {
    if (!form.fecha || !form.nombre.trim()) { alertError('Error', 'Completá fecha y nombre'); return }
    setSubmitting(true)
    try {
      if (editId) {
        await actualizarFeriado(editId, form.fecha, form.nombre)
        notify('Feriado actualizado')
      } else {
        await guardarFeriado(companyId, form.fecha, form.nombre)
        notify('Feriado agregado')
      }
      resetForm()
      setData(await listarFeriados(companyId, anio))
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  async function handleEliminar(id) {
    if (!window.confirm('¿Eliminar este feriado?')) return
    await eliminarFeriado(id)
    setData(await listarFeriados(companyId, anio))
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      const n = await seedFeriadosPY(companyId, anio)
      notify(`${n} feriados cargados para ${anio}`)
      setData(await listarFeriados(companyId, anio))
    } catch (err) { alertError('Error', err.message) }
    finally { setSeeding(false) }
  }

  return (
    <div className="config-table-wrap">
      <p className="meta" style={{ fontSize: '0.78rem', marginBottom: 12 }}>
        Gestioná los feriados nacionales. Los días feriados no se marcan como ausentes en el Control Horario.
        Si hay marcaciones en un feriado, todo el tiempo se contabiliza como extra.
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div><div className="form-label">Año</div>
          <input className="form-input" type="number" min="2020" max="2050" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ width: 100, fontSize: '0.82rem' }} />
        </div>
        <Button size="sm" onClick={handleSeed} disabled={seeding} style={{ marginTop: 20 }}>{seeding ? '...' : '🌱 Seed PY ' + anio}</Button>
      </div>

      {canEdit && (
        <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
          <div><div className="form-label">Fecha</div>
            <input className="form-input" type="date" value={form.fecha} onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))} style={{ width: 140, fontSize: '0.82rem' }} />
          </div>
          <div><div className="form-label">Nombre</div>
            <input className="form-input" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Día de la Independencia" style={{ width: 200, fontSize: '0.82rem' }} />
          </div>
          <Button size="sm" type="submit" onClick={handleSave} disabled={submitting}>{submitting ? '...' : editId ? 'Actualizar' : 'Agregar'}</Button>
          {editId && <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>}
        </form>
      )}

      {data.length === 0 ? (
        <p className="meta" style={{ padding: 16, textAlign: 'center' }}>Sin feriados registrados para {anio}. Usá "Seed PY" para cargar los feriados nacionales.</p>
      ) : (
        <div className="table-wrapper">
          <table className="table" style={{ fontSize: '0.85rem' }}>
            <thead><tr><th>Fecha</th><th>Nombre</th><th></th></tr></thead>
            <tbody>
              {data.map((f) => (
                <tr key={f.id}>
                  <td data-label="Fecha">{f.fecha?.slice(0, 10)}</td>
                  <td data-label="Nombre" style={{ fontWeight: 600 }}>{f.nombre}</td>
                  <td>{canEdit && <>
                    <button onClick={() => { setEditId(f.id); setForm({ fecha: f.fecha?.slice(0, 10), nombre: f.nombre }) }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.82rem', marginRight: 8 }}>📝</button>
                    <button onClick={() => handleEliminar(f.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.82rem' }}>✕</button>
                  </>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
