import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, alertError, notify, getSupabase, PERMISSIONS } from '@saas/core'
import { listarNovedades, guardarNovedad, eliminarNovedad } from '../data/novedades'
import { listarConceptos } from '../data/conceptos'
import { obtenerDetallePeriodo } from '../data/periodos'

export function NovedadesPage() {
  const { periodoId } = useParams()
  const { activeCompanyId, can } = useAuth()
  const puedeEditar = can(PERMISSIONS.NOMINA_CREAR)
  const [data, setData] = useState([])
  const [detalle, setDetalle] = useState([])
  const [conceptos, setConceptos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    empleado_id: '', concepto_id: '', tipo_aplicacion: 'unico',
    monto: '', monto_periodo: '', fecha_inicio: '', fecha_fin: '',
    descripcion: '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    const [nov, det, conc] = await Promise.all([
      listarNovedades(periodoId).catch(() => []),
      obtenerDetallePeriodo(periodoId).catch(() => []),
      listarConceptos(activeCompanyId).catch(() => []),
    ])
    setData(nov)
    // Si no hay detalle (período no calculado), cargar empleados activos
    if (!det || det.length === 0) {
      const supabase = getSupabase()
      const { data: emps } = await supabase
        .from('empleados')
        .select('id, nombre, apellido')
        .eq('company_id', activeCompanyId)
        .eq('activo', true)
        .order('apellido')
      setDetalle((emps || []).map((e) => ({ empleado_id: e.id, empleado: e })))
    } else {
      setDetalle(det)
    }
    setConceptos(conc.filter((c) => c.tipo !== 'base' && c.tipo !== 'aporte_patronal'))
    setLoading(false)
  }

  useEffect(() => { load() }, [periodoId])

  function resetForm() {
    setForm({ empleado_id: '', concepto_id: '', tipo_aplicacion: 'unico', monto: '', monto_periodo: '', fecha_inicio: '', fecha_fin: '', descripcion: '' })
  }

  async function handleGuardar() {
    const concSel = conceptos.find((c) => c.id === form.concepto_id)
    const tieneFormula = concSel?.formula && concSel.formula !== ''
    if (!form.empleado_id || !form.concepto_id || (!form.monto && !tieneFormula) || !form.fecha_inicio) {
      alertError('Error', 'Empleado, concepto, monto y fecha inicio requeridos'); return
    }
    setSubmitting(true)
    try {
      await guardarNovedad(activeCompanyId, { ...form, periodo_id: periodoId })
      notify('Novedad creada')
      setShowModal(false)
      resetForm()
      load()
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  function onTipoChange(tipo) {
    const newForm = { ...form, tipo_aplicacion: tipo }
    if (tipo === 'unico') {
      newForm.fecha_fin = ''
      newForm.monto_periodo = ''
    } else if (tipo === 'prorrateado') {
      newForm.fecha_fin = ''
    }
    setForm(newForm)
  }

  const empleadosMap = {}
  detalle.forEach((d) => { empleadosMap[d.empleado_id] = d.empleado })

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📋 Novedades</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to={`/nomina/periodos/${periodoId}`}><Button variant="ghost" size="sm">← Volver</Button></Link>
            {puedeEditar && <Button size="sm" onClick={() => { resetForm(); setShowModal(true) }}>➕ Agregar</Button>}
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="card"><p className="meta" style={{ padding: 24, textAlign: 'center' }}>Sin novedades para este período.</p></div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.82rem' }}>
              <thead><tr><th>Empleado</th><th>Concepto</th><th>Tipo</th><th>Monto total</th><th>Desde</th><th>Hasta</th><th>Por período</th><th>Descripción</th><th></th></tr></thead>
              <tbody>
                {data.map((n) => (
                  <tr key={n.id}>
                    <td style={{ fontWeight: 600 }}>{n.empleado?.apellido}, {n.empleado?.nombre}</td>
                    <td>{n.concepto?.codigo} — {n.concepto?.nombre}</td>
                    <td><span className="badge" style={{
                      background: n.tipo_aplicacion === 'fijo' ? '#dbeafe' : n.tipo_aplicacion === 'prorrateado' ? '#ede9fe' : '#f3f4f6',
                      color: n.tipo_aplicacion === 'fijo' ? '#2563eb' : n.tipo_aplicacion === 'prorrateado' ? '#7c3aed' : '#6b7280',
                    }}>{n.tipo_aplicacion}</span></td>
                    <td style={{ fontWeight: 600 }}>${Number(n.monto).toLocaleString()}</td>
                    <td className="meta">{n.fecha_inicio?.slice(0, 10)}</td>
                    <td className="meta">{n.fecha_fin?.slice(0, 10)}</td>
                    <td>{n.monto_periodo ? `$${Number(n.monto_periodo).toLocaleString()}` : '—'}</td>
                    <td className="meta" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.descripcion || '—'}</td>
                    <td>{puedeEditar && <button onClick={async () => { if (window.confirm('¿Eliminar?')) { await eliminarNovedad(n.id); load() } }} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>✕</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 440, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>➕ Nueva novedad</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><div className="meta">Empleado</div>
                <select className="form-input" value={form.empleado_id} onChange={(e) => setForm((p) => ({ ...p, empleado_id: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">—</option>
                  {detalle.map((d) => <option key={d.empleado_id} value={d.empleado_id}>{d.empleado?.apellido}, {d.empleado?.nombre}</option>)}
                </select>
              </div>
              <div><div className="meta">Concepto</div>
                <select className="form-input" value={form.concepto_id} onChange={(e) => setForm((p) => ({ ...p, concepto_id: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">—</option>
                  {conceptos.map((c) => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
                </select>
              </div>
              <div><div className="meta">Tipo de aplicación</div>
                <select className="form-input" value={form.tipo_aplicacion} onChange={(e) => onTipoChange(e.target.value)} style={{ width: '100%' }}>
                  <option value="unico">Única (un solo pago)</option>
                  <option value="fijo">Fija (cada período del rango)</option>
                  <option value="prorrateado">Prorrateada (en cuotas)</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><div className="meta">Monto total</div><input className="form-input" type="number" step="0.01" value={form.monto} onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))} style={{ width: '100%' }} /></div>
                {form.tipo_aplicacion === 'prorrateado' && (
                  <div><div className="meta">Cuota por período</div><input className="form-input" type="number" step="0.01" value={form.monto_periodo} onChange={(e) => setForm((p) => ({ ...p, monto_periodo: e.target.value }))} style={{ width: '100%' }} /></div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><div className="meta">Fecha inicio</div><input className="form-input" type="date" value={form.fecha_inicio} onChange={(e) => setForm((p) => ({ ...p, fecha_inicio: e.target.value }))} style={{ width: '100%' }} /></div>
                <div><div className="meta">Fecha fin</div>
                  {form.tipo_aplicacion === 'prorrateado' ? (
                    <p className="meta" style={{ paddingTop: 6, fontSize: '0.78rem' }}>Se calcula automáticamente</p>
                  ) : (
                    <input className="form-input" type="date" value={form.fecha_fin} onChange={(e) => setForm((p) => ({ ...p, fecha_fin: e.target.value }))} style={{ width: '100%' }}
                      disabled={form.tipo_aplicacion === 'unico'} />
                  )}
                </div>
              </div>
              <div><div className="meta">Descripción (opcional)</div><input className="form-input" value={form.descripcion} onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} placeholder="Ej: Bono por productividad" style={{ width: '100%' }} /></div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Button size="sm" onClick={handleGuardar} disabled={submitting}>{submitting ? '...' : '💾 Guardar'}</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancelar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
