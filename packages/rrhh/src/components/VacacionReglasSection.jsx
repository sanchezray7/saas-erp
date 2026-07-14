import { useEffect, useState } from 'react'
import { Button, alertError, notify, getSupabase } from '@saas/core'
import { listarReglasVacaciones, guardarReglaVacacion, eliminarReglaVacacion } from '../data/asistencia'

export function VacacionReglasSection({ companyId, canEdit }) {
  const [data, setData] = useState([])
  const [form, setForm] = useState({ desde_anios: '', hasta_anios: '', dias: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    listarReglasVacaciones(companyId).then(setData).catch(() => {})
  }, [companyId])

  async function handleAgregar() {
    if (!form.desde_anios || !form.hasta_anios || !form.dias) { alertError('Error', 'Completá todos los campos'); return }
    if (data.some((r) => Number(r.desde_anios) === Number(form.desde_anios))) { alertError('Error', 'Ya existe una regla con ese rango inicial'); return }
    setSubmitting(true)
    try {
      await guardarReglaVacacion(companyId, {
        desde_anios: Number(form.desde_anios), hasta_anios: Number(form.hasta_anios), dias: Number(form.dias),
      })
      setForm({ desde_anios: '', hasta_anios: '', dias: '' })
      setData(await listarReglasVacaciones(companyId))
      notify('Regla agregada')
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  async function handleEliminar(id) {
    if (!window.confirm('¿Eliminar esta regla?')) return
    await eliminarReglaVacacion(id)
    setData(await listarReglasVacaciones(companyId))
  }

  return (
    <div className="config-table-wrap">
      <p className="meta" style={{ fontSize: '0.78rem', marginBottom: 12 }}>
        Configurá los rangos de antigüedad y los días de vacaciones que corresponden a cada uno.
        El cálculo automático usará la primera regla que coincida con los años de servicio del empleado.
      </p>

      {data.length > 0 && (
        <div className="table-wrapper" style={{ marginBottom: 16 }}>
          <table className="table" style={{ fontSize: '0.85rem' }}>
            <thead><tr><th>Desde (años)</th><th>Hasta (años)</th><th>Días</th><th></th></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td>{r.desde_anios}</td>
                  <td>{r.hasta_anios === 99 ? '99+' : r.hasta_anios}</td>
                  <td style={{ fontWeight: 600 }}>{r.dias}</td>
                  <td>{canEdit && <button onClick={() => handleEliminar(r.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.82rem' }}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div><div className="meta" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Desde</div><input className="form-input" type="number" min="0" value={form.desde_anios} onChange={(e) => setForm((p) => ({ ...p, desde_anios: e.target.value }))} style={{ width: 70, fontSize: '0.82rem' }} /></div>
          <div><div className="meta" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Hasta</div><input className="form-input" type="number" min="0" value={form.hasta_anios} onChange={(e) => setForm((p) => ({ ...p, hasta_anios: e.target.value }))} style={{ width: 70, fontSize: '0.82rem' }} /></div>
          <div><div className="meta" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Días</div><input className="form-input" type="number" step="0.5" min="0" value={form.dias} onChange={(e) => setForm((p) => ({ ...p, dias: e.target.value }))} style={{ width: 70, fontSize: '0.82rem' }} /></div>
          <Button size="sm" type="submit" onClick={handleAgregar} disabled={submitting}>{submitting ? '...' : '+ Agregar'}</Button>
        </form>
      )}
    </div>
  )
}
