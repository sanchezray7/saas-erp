import { useEffect, useState } from 'react'
import { useAuth, Button, alertError, notify, getSupabase } from '@saas/core'

export function TiposCambioSection({ companyId, canEdit }) {
  const supabase = getSupabase()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ moneda_origen: '', moneda_destino: 'PYG', tasa: '', fecha: new Date().toISOString().slice(0, 10) })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase.from('tipos_cambio').select('*').eq('company_id', companyId).order('fecha', { ascending: false }).then(({ data: d }) => setData(d || [])).catch(() => {}).finally(() => setLoading(false))
  }, [companyId, supabase])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.moneda_origen || !form.moneda_destino || !form.tasa) { alertError('Error', 'Completá moneda origen, destino y tasa'); return }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('tipos_cambio').insert({
        company_id: companyId, moneda_origen: form.moneda_origen, moneda_destino: form.moneda_destino,
        tasa: Number(form.tasa), fecha: form.fecha,
      })
      if (error) throw error
      setForm({ moneda_origen: '', moneda_destino: 'PYG', tasa: '', fecha: new Date().toISOString().slice(0, 10) })
      const { data: d } = await supabase.from('tipos_cambio').select('*').eq('company_id', companyId).order('fecha', { ascending: false })
      setData(d || [])
      notify('Tipo de cambio guardado')
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este tipo de cambio?')) return
    await supabase.from('tipos_cambio').delete().eq('id', id)
    setData((prev) => prev.filter((d) => d.id !== id))
  }

  if (loading) return <p className="meta" style={{ padding: 16 }}>Cargando...</p>

  const MONEDAS = ['PYG', 'USD', 'BRL', 'ARS', 'CLP', 'COP', 'PEN', 'UYU', 'BOB', 'MXN']

  return (
    <div className="config-table-wrap">
      <p className="meta" style={{ fontSize: '0.78rem', marginBottom: 12 }}>
        Registrá las tasas de cambio entre cualquier par de monedas. La tasa más reciente a cada fecha se usa automáticamente en la consolidación.
      </p>

      {canEdit && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div className="meta" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Origen</div>
            <select className="form-input" value={form.moneda_origen} onChange={(e) => setForm((p) => ({ ...p, moneda_origen: e.target.value }))} style={{ width: 80, fontSize: '0.82rem' }} required>
              <option value="">—</option>
              {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ alignSelf: 'center', paddingBottom: 6, fontSize: '0.85rem' }}>→</div>
          <div>
            <div className="meta" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Destino</div>
            <select className="form-input" value={form.moneda_destino} onChange={(e) => setForm((p) => ({ ...p, moneda_destino: e.target.value }))} style={{ width: 80, fontSize: '0.82rem' }} required>
              <option value="">—</option>
              {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div className="meta" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Tasa</div>
            <input className="form-input" type="number" step="0.000001" min="0" value={form.tasa} onChange={(e) => setForm((p) => ({ ...p, tasa: e.target.value }))} placeholder="0.00" style={{ width: 110, fontSize: '0.82rem' }} required />
          </div>
          <div>
            <div className="meta" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Fecha</div>
            <input className="form-input" type="date" value={form.fecha} onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))} style={{ width: 130, fontSize: '0.82rem' }} />
          </div>
          <Button size="sm" type="submit" disabled={submitting}>{submitting ? '...' : '+ Agregar'}</Button>
        </form>
      )}

      {data.length === 0 ? (
        <p className="meta" style={{ padding: 16, textAlign: 'center' }}>No hay tipos de cambio registrados</p>
      ) : (
        <div className="table-wrapper">
          <table className="table" style={{ fontSize: '0.85rem' }}>
            <thead><tr><th>Par</th><th>Tasa</th><th>Fecha</th><th></th></tr></thead>
            <tbody>
              {data.map((tc) => (
                <tr key={tc.id}>
                  <td style={{ fontWeight: 600 }}>{tc.moneda_origen} → {tc.moneda_destino}</td>
                  <td>{Number(tc.tasa).toFixed(6)}</td>
                  <td className="meta">{tc.fecha?.slice(0, 10)}</td>
                  <td>{canEdit && <button onClick={() => handleDelete(tc.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.82rem' }}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
