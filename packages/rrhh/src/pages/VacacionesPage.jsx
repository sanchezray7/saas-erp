import { useEffect, useState, useCallback } from 'react'
import { useAuth, Button, Skeleton, alertError, notify, PERMISSIONS } from '@saas/core'
import { obtenerVacaciones, guardarVacaciones, actualizarAdicionalesVacaciones, listarSolicitudesVacaciones, solicitarVacaciones, aprobarVacaciones, listarReglasVacaciones, calcularDiasPorAntiguedad } from '../data/asistencia'
import { listarEmpleados, listarContratos, obtenerEmpleadoPorUserId, listarDepartamentos, obtenerContratoActivo } from '../data/empleados'

export function VacacionesPage() {
  const { activeCompanyId, user, can } = useAuth()
  const anioActual = new Date().getFullYear()
  const puedeEditar = can(PERMISSIONS.CONFIG_CREAR)
  const [empleados, setEmpleados] = useState([])
  const [empId, setEmpId] = useState('')
  const [vac, setVac] = useState(null)
  const [reglas, setReglas] = useState([])
  const [contratos, setContratos] = useState([])
  const [diasPorReglas, setDiasPorReglas] = useState(0)
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ fecha_inicio: '', fecha_fin: '', dias: '' })
  const [adjModal, setAdjModal] = useState(false)
  const [adjValor, setAdjValor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [puedoAprobar, setPuedoAprobar] = useState(false)
  const esAdmin = can(PERMISSIONS.CONFIG_CREAR)

  const chequearPermiso = useCallback(async (empleadoId) => {
    if (!user?.id || esAdmin) { setPuedoAprobar(true); return }
    if (!empleadoId) { setPuedoAprobar(false); return }
    const miEmpleado = await obtenerEmpleadoPorUserId(user.id)
    if (!miEmpleado) { setPuedoAprobar(false); return }
    const miContrato = await obtenerContratoActivo(miEmpleado.id)
    if (!miContrato?.puesto_id) { setPuedoAprobar(false); return }
    const deptos = await listarDepartamentos(activeCompanyId)
    const misDeptosIds = deptos.filter((d) => d.puesto_responsable_id === miContrato.puesto_id).map((d) => d.id)
    const supabase = (await import('@saas/core')).getSupabase()
    const { data: contratos } = await supabase
      .from('empleado_contratos').select('empleado_id')
      .in('departamento_id', misDeptosIds).is('vigencia_hasta', null)
    setPuedoAprobar((contratos || []).some((c) => c.empleado_id === empleadoId))
  }, [user?.id, esAdmin, activeCompanyId])

  async function load() {
    const emps = await listarEmpleados(activeCompanyId).catch(() => [])
    setEmpleados(emps)
    if (!empId) { setLoading(false); return }
    setLoading(true)
    const [v, s, reg, contratosData] = await Promise.all([
      obtenerVacaciones(activeCompanyId, empId, String(anioActual)).catch(() => null),
      listarSolicitudesVacaciones(activeCompanyId, empId).catch(() => []),
      listarReglasVacaciones(activeCompanyId).catch(() => []),
      listarContratos(empId).catch(() => []),
    ])
    setVac(v); setSolicitudes(s); setReglas(reg); setContratos(contratosData)
    // Calcular días por reglas según antigüedad
    if (contratosData.length > 0) {
      const c = contratosData.reduce((a, b) => a.vigencia_desde < b.vigencia_desde ? a : b)
      const anios = Math.floor((Date.now() - new Date(c.vigencia_desde).getTime()) / (365.25 * 86400000))
      setDiasPorReglas(calcularDiasPorAntiguedad(reg, anios))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [activeCompanyId, empId])
  useEffect(() => { chequearPermiso(empId) }, [chequearPermiso, empId])

  async function handleSolicitar() {
    if (!form.fecha_inicio || !form.fecha_fin || !form.dias) { alertError('Error', 'Completá todos los campos'); return }
    setSubmitting(true)
    try {
      await solicitarVacaciones(activeCompanyId, { empleado_id: empId, ...form, dias: Number(form.dias) })
      notify('Solicitud enviada')
      setShowModal(false)
      setForm({ fecha_inicio: '', fecha_fin: '', dias: '' })
      load()
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  async function handleAsignar() {
    if (!asignarDias || Number(asignarDias) <= 0) { alertError('Error', 'Ingresá días válidos'); return }
    setSubmitting(true)
    try {
      await guardarVacaciones(activeCompanyId, empId, String(anioActual), Number(asignarDias))
      notify('Vacaciones asignadas')
      setAsignarModal(false)
      load()
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  async function handleAprobar(id, estado) {
    try {
      await aprobarVacaciones(id, user?.id, estado)
      notify(estado === 'aprobado' ? 'Vacaciones aprobadas' : 'Solicitud rechazada')
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  if (loading) return <Skeleton.Card />

  const disponibles = Number(vac?.dias_asignados || 0) - Number(vac?.dias_disfrutados || 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>🏖 Vacaciones</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-input" value={empId} onChange={(e) => setEmpId(e.target.value)} style={{ width: 220, fontSize: '0.82rem' }}>
            <option value="">— Seleccionar empleado —</option>
            {empleados.map((e) => <option key={e.id} value={e.id}>{e.apellido}, {e.nombre}</option>)}
          </select>
          {empId && (
            <>
              <Button size="sm" onClick={() => { setShowModal(true); setForm({ fecha_inicio: '', fecha_fin: '', dias: '' }) }} disabled={disponibles <= 0}>📅 Solicitar vacaciones</Button>
            </>
          )}
        </div>
      </div>

      {!empId ? (
        <div className="card"><p className="meta" style={{ padding: 24, textAlign: 'center' }}>Seleccioná un empleado</p></div>
      ) : (
        <>
          <div className="card">
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>🏖 Saldo {anioActual}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
              <div><div className="meta">Por reglas</div><div style={{ fontSize: '1rem', fontWeight: 700, color: '#2563eb' }}>{diasPorReglas.toFixed(1)}</div><div className="meta" style={{ fontSize: '0.65rem' }}>según antigüedad</div></div>
              <div><div className="meta">Adicionales</div><div style={{ fontSize: '1rem', fontWeight: 700, color: vac?.dias_adicionales > 0 ? '#d97706' : '#6b7280' }}>{(vac?.dias_adicionales || 0) > 0 ? '+' : ''}{Number(vac?.dias_adicionales || 0).toFixed(1)}</div>
                {puedeEditar && (vac?.id ? <button onClick={() => { setAdjValor(String(vac?.dias_adicionales || 0)); setAdjModal(true) }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.72rem', padding: 0 }}>✏️ Ajustar</button> : <span className="meta" style={{ fontSize: '0.65rem' }}>—</span>)}
              </div>
              <div><div className="meta">Asignados</div><div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563eb' }}>{Number(vac?.dias_asignados || 0).toFixed(1)}</div></div>
              <div><div className="meta">Disfrutados</div><div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#d97706' }}>{Number(vac?.dias_disfrutados || 0).toFixed(1)}</div></div>
              <div><div className="meta">Disponibles</div><div style={{ fontSize: '1.2rem', fontWeight: 800, color: disponibles > 0 ? '#16a34a' : '#dc2626' }}>{disponibles.toFixed(1)}</div></div>
            </div>
            {!vac?.id && diasPorReglas > 0 && (
              <div style={{ marginTop: 12 }}>
                <Button size="sm" onClick={async () => {
                  await guardarVacaciones(activeCompanyId, empId, String(anioActual), diasPorReglas)
                  load()
                }}>📝 Inicializar con {diasPorReglas} días (según reglas)</Button>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>📋 Solicitudes</h3>
            {solicitudes.length === 0 ? (
              <p className="meta" style={{ padding: 16, textAlign: 'center' }}>Sin solicitudes</p>
            ) : (
              <div className="table-wrapper">
                <table className="table" style={{ fontSize: '0.82rem' }}>
                  <thead><tr><th>Desde</th><th>Hasta</th><th>Días</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {solicitudes.map((s) => (
                      <tr key={s.id}>
                        <td className="meta">{s.fecha_inicio?.slice(0, 10)}</td>
                        <td className="meta">{s.fecha_fin?.slice(0, 10)}</td>
                        <td style={{ fontWeight: 600 }}>{Number(s.dias).toFixed(1)}</td>
                        <td>
                          <span className="badge" style={{
                            background: s.estado === 'aprobado' ? '#dcfce7' : s.estado === 'rechazado' ? '#fef2f2' : '#fef3c7',
                            color: s.estado === 'aprobado' ? '#16a34a' : s.estado === 'rechazado' ? '#dc2626' : '#d97706',
                          }}>{s.estado}</span>
                        </td>
                        <td>
                          {s.estado === 'pendiente' && can(PERMISSIONS.RRHH_APROBAR) && puedeAprobar && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => handleAprobar(s.id, 'aprobado')} style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer' }}>✅</button>
                              <button onClick={() => handleAprobar(s.id, 'rechazado')} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>❌</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal ajustar adicionales */}
      {adjModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setAdjModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 360, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>✏️ Ajustar días adicionales</h3>
            <p className="meta" style={{ fontSize: '0.82rem', marginBottom: 8 }}>
              Días por reglas: <strong>{diasPorReglas}</strong> · Valor actual: <strong>{vac?.dias_adicionales || 0}</strong>
            </p>
            <input className="form-input" type="number" step="0.5" value={adjValor} onChange={(e) => setAdjValor(e.target.value)} placeholder="Ej: 5" style={{ width: '100%' }} />
            <p className="meta" style={{ fontSize: '0.75rem', marginTop: 4 }}>Usá valores positivos para aumentar, negativos para disminuir. El total (reglas + adicionales) será el nuevo asignado.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button size="sm" onClick={async () => {
                setSubmitting(true)
                try {
                  await actualizarAdicionalesVacaciones(vac.id, Number(adjValor))
                  notify('Días adicionales actualizados')
                  setAdjModal(false)
                  load()
                } catch (err) { alertError('Error', err.message) }
                finally { setSubmitting(false) }
              }} disabled={submitting}>{submitting ? '...' : '💾 Guardar'}</Button>
              <Button variant="ghost" size="sm" onClick={() => setAdjModal(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal solicitar */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 360, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>📅 Solicitar vacaciones</h3>
            <p className="meta" style={{ fontSize: '0.82rem', marginBottom: 8 }}>Disponibles: {disponibles.toFixed(1)} días</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><div className="meta">Inicio</div><input className="form-input" type="date" value={form.fecha_inicio} onChange={(e) => setForm((p) => ({ ...p, fecha_inicio: e.target.value }))} /></div>
                <div><div className="meta">Fin</div><input className="form-input" type="date" value={form.fecha_fin} onChange={(e) => setForm((p) => ({ ...p, fecha_fin: e.target.value }))} /></div>
              </div>
              <div><div className="meta">Días</div><input className="form-input" type="number" min="0.5" step="0.5" value={form.dias} onChange={(e) => setForm((p) => ({ ...p, dias: e.target.value }))} /></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" onClick={handleSolicitar} disabled={submitting}>{submitting ? '...' : '📅 Solicitar'}</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancelar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
