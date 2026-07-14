import { useEffect, useState, useCallback } from 'react'
import { useAuth, Button, Skeleton, alertError, notify, getSupabase, PERMISSIONS } from '@saas/core'
import { listarAusencias, guardarAusencia, aprobarAusencia, listarAusenciaTipos } from '../data/asistencia'
import { listarEmpleados, obtenerEmpleadoPorUserId, listarDepartamentos, obtenerContratoActivo } from '../data/empleados'

export function AusenciasPage() {
  const { activeCompanyId, user, can } = useAuth()
  const [data, setData] = useState([])
  const [tipos, setTipos] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ empleado_id: '', tipo_id: '', fecha_inicio: '', fecha_fin: '', motivo: '' })
  const [submitting, setSubmitting] = useState(false)
  const [empleadosAAprobar, setEmpleadosAAprobar] = useState(new Set())
  const esAdmin = can(PERMISSIONS.CONFIG_CREAR)

  const cargarPermisos = useCallback(async () => {
    if (!user?.id || esAdmin) { setEmpleadosAAprobar(new Set()); return }
    const miEmpleado = await obtenerEmpleadoPorUserId(user.id)
    if (!miEmpleado) { setEmpleadosAAprobar(new Set()); return }
    const miContrato = await obtenerContratoActivo(miEmpleado.id)
    if (!miContrato?.puesto_id) { setEmpleadosAAprobar(new Set()); return }
    const deptos = await listarDepartamentos(activeCompanyId)
    const misDeptosIds = deptos.filter((d) => d.puesto_responsable_id === miContrato.puesto_id).map((d) => d.id)
    // Obtener contratos activos de todos los empleados en esos deptos
    const supabase = getSupabase()
    const { data: contratos } = await supabase
      .from('empleado_contratos')
      .select('empleado_id')
      .in('departamento_id', misDeptosIds)
      .is('vigencia_hasta', null)
    setEmpleadosAAprobar(new Set((contratos || []).map((c) => c.empleado_id)))
  }, [user?.id, esAdmin, activeCompanyId])

  async function load() {
    setLoading(true)
    const [aus, t, emps] = await Promise.all([
      listarAusencias(activeCompanyId, filtro || null).catch(() => []),
      listarAusenciaTipos(activeCompanyId).catch(() => []),
      listarEmpleados(activeCompanyId).catch(() => []),
    ])
    setData(aus); setTipos(t); setEmpleados(emps)
    setLoading(false)
  }

  useEffect(() => { load() }, [activeCompanyId, filtro])
  useEffect(() => { cargarPermisos() }, [cargarPermisos])

  async function handleCrear() {
    if (!form.empleado_id || !form.tipo_id || !form.fecha_inicio || !form.fecha_fin) { alertError('Error', 'Completá todos los campos'); return }
    setSubmitting(true)
    try {
      await guardarAusencia(activeCompanyId, form)
      notify('Solicitud creada')
      setShowModal(false)
      setForm({ empleado_id: '', tipo_id: '', fecha_inicio: '', fecha_fin: '', motivo: '' })
      load()
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  async function handleAprobar(id, estado) {
    try {
      await aprobarAusencia(id, user?.id, estado)
      notify(`Solicitud ${estado === 'aprobado' ? 'aprobada' : 'rechazada'}`)
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>🏖 Ausencias y permisos</h1>
          <Button size="sm" onClick={() => setShowModal(true)}>+ Nueva solicitud</Button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {['', 'pendiente', 'aprobado', 'rechazado'].map((e) => (
            <button key={e} onClick={() => setFiltro(e)} style={{
              padding: '4px 12px', borderRadius: 6, border: filtro === e ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
              background: filtro === e ? 'var(--color-accent)' : 'transparent',
              color: filtro === e ? '#fff' : 'var(--color-text)', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem',
            }}>{e === '' ? 'Todas' : e}</button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="card"><p className="meta" style={{ padding: 24, textAlign: 'center' }}>Sin solicitudes</p></div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead><tr><th>Empleado</th><th>Tipo</th><th>Desde</th><th>Hasta</th><th>Motivo</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.empleado?.apellido}, {a.empleado?.nombre}</td>
                    <td>{a.tipo?.nombre || '—'}</td>
                    <td className="meta">{a.fecha_inicio?.slice(0, 10)}</td>
                    <td className="meta">{a.fecha_fin?.slice(0, 10)}</td>
                    <td className="meta" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.motivo || '—'}</td>
                    <td>
                      <span className="badge" style={{
                        background: a.estado === 'aprobado' ? '#dcfce7' : a.estado === 'rechazado' ? '#fef2f2' : '#fef3c7',
                        color: a.estado === 'aprobado' ? '#16a34a' : a.estado === 'rechazado' ? '#dc2626' : '#d97706',
                      }}>{a.estado}</span>
                    </td>
                    <td>
                      {a.estado === 'pendiente' && can(PERMISSIONS.RRHH_APROBAR) && (esAdmin || empleadosAAprobar.has(a.empleado_id)) && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => handleAprobar(a.id, 'aprobado')} style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', fontSize: '0.85rem' }}>✅</button>
                          <button onClick={() => handleAprobar(a.id, 'rechazado')} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem' }}>❌</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal nueva solicitud */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 420, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Nueva solicitud de ausencia</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select className="form-input" value={form.empleado_id} onChange={(e) => setForm((p) => ({ ...p, empleado_id: e.target.value }))}>
                <option value="">— Empleado —</option>
                {empleados.map((e) => <option key={e.id} value={e.id}>{e.apellido}, {e.nombre}</option>)}
              </select>
              <select className="form-input" value={form.tipo_id} onChange={(e) => setForm((p) => ({ ...p, tipo_id: e.target.value }))}>
                <option value="">— Tipo —</option>
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre} {t.pagado ? '(💰 pagado)' : ''}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><div className="meta">Fecha inicio</div><input className="form-input" type="date" value={form.fecha_inicio} onChange={(e) => setForm((p) => ({ ...p, fecha_inicio: e.target.value }))} /></div>
                <div><div className="meta">Fecha fin</div><input className="form-input" type="date" value={form.fecha_fin} onChange={(e) => setForm((p) => ({ ...p, fecha_fin: e.target.value }))} /></div>
              </div>
              <input className="form-input" placeholder="Motivo (opcional)" value={form.motivo} onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" onClick={handleCrear} disabled={submitting}>{submitting ? '...' : '💾 Crear solicitud'}</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancelar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
