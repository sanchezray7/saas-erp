import { useEffect, useState } from 'react'
import { useAuth, Button, Skeleton, alertError, notify } from '@saas/core'
import { listarEmpleados } from '../data/empleados'
import { listarCalendarios, crearCalendario, regenerarCalendario, eliminarCalendario, listarDiasCalendario, asignarCalendarioAEmpleado, asignarCalendarioATodos, listarDiasEmpleado, guardarExcepcion, listarPatrones, listarTurnos } from '../data/turnos'

export function PlanificarTurnosPage() {
  const { activeCompanyId } = useAuth()
  const hoy = new Date()
  const [calendarios, setCalendarios] = useState([])
  const [patrones, setPatrones] = useState([])
  const [turnos, setTurnos] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [loading, setLoading] = useState(true)
  const [calId, setCalId] = useState('')
  const [dias, setDias] = useState([])
  const [desde, setDesde] = useState(hoy.toISOString().slice(0, 10))
  const [hasta, setHasta] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10) })
  const [nuevoCal, setNuevoCal] = useState({ nombre: '', patron_id: '' })
  const [creando, setCreando] = useState(false)
  const [asignando, setAsignando] = useState(false)
  const [editandoExc, setEditandoExc] = useState(null)
  const [excTurnoId, setExcTurnoId] = useState('')
  const [excMotivo, setExcMotivo] = useState('')

  useEffect(() => {
    Promise.all([
      listarCalendarios(activeCompanyId).catch(() => []),
      listarPatrones(activeCompanyId).catch(() => []),
      listarTurnos(activeCompanyId).catch(() => []),
      listarEmpleados(activeCompanyId).catch(() => []),
    ]).then(([c, p, t, e]) => { setCalendarios(c); setPatrones(p); setTurnos(t); setEmpleados(e) }).finally(() => setLoading(false))
  }, [activeCompanyId])

  async function handleCrear() {
    if (!nuevoCal.nombre.trim() || !nuevoCal.patron_id) { alertError('Error', 'Nombre y patrón requeridos'); return }
    setCreando(true)
    try {
      const id = await crearCalendario(activeCompanyId, nuevoCal.nombre, nuevoCal.patron_id, desde, hasta)
      setCalId(id); setNuevoCal({ nombre: '', patron_id: '' })
      setCalendarios(await listarCalendarios(activeCompanyId))
      setDias(await listarDiasCalendario(id, desde, hasta))
      notify('Calendario creado')
    } catch (err) { alertError('Error', err.message) }
    finally { setCreando(false) }
  }

  async function handleSeleccionar(id) {
    setCalId(id)
    setDias(await listarDiasCalendario(id, desde, hasta))
  }

  async function handleRegenerar() {
    if (!calId) return
    setCreando(true)
    try {
      await regenerarCalendario(calId, desde, hasta)
      setDias(await listarDiasCalendario(calId, desde, hasta))
      notify('Calendario regenerado')
    } catch (err) { alertError('Error', err.message) }
    finally { setCreando(false) }
  }

  async function handleAsignarTodos() {
    if (!calId) return
    if (!window.confirm('¿Asignar este calendario a todos los empleados?')) return
    setAsignando(true)
    try {
      await asignarCalendarioATodos(activeCompanyId, calId)
      notify('Calendario asignado a todos los empleados')
    } catch (err) { alertError('Error', err.message) }
    finally { setAsignando(false) }
  }

  async function handleAsignarEmp(empleadoId) {
    if (!calId) return
    await asignarCalendarioAEmpleado(empleadoId, calId)
    notify('Asignado')
  }

  async function handleExcepcion(fecha) {
    await guardarExcepcion(activeCompanyId, calId, null, fecha, excTurnoId || null, excMotivo)
    setEditandoExc(null)
    setDias(await listarDiasCalendario(calId, desde, hasta))
    notify('Excepción guardada')
  }

  if (loading) return <Skeleton.Card />

  // Agrupar días por semana
  function agruparSemanas(diasArray) {
    if (!diasArray || diasArray.length === 0) return []
    const semanas = []; let semana = []
    const [y, m, d] = diasArray[0].fecha.split('-').map(Number)
    const diaSem = (new Date(y, m - 1, d).getDay() + 6) % 7 // 0=lunes
    for (let i = 0; i < diaSem; i++) semana.push(null)
    diasArray.forEach((dia) => {
      semana.push(dia)
      if (semana.length === 7) { semanas.push(semana); semana = [] }
    })
    if (semana.length > 0) semanas.push(semana)
    return semanas
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📅 Planificar turnos</h1>
        </div>

        {/* Crear calendario */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16, padding: 16, background: '#f9fafb', borderRadius: 8 }}>
          <div><div className="form-label">Nombre del calendario</div><input className="form-input" value={nuevoCal.nombre} onChange={(e) => setNuevoCal((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Planta A" style={{ width: 150, fontSize: '0.82rem' }} /></div>
          <div><div className="form-label">Patrón</div><select className="form-input" value={nuevoCal.patron_id} onChange={(e) => setNuevoCal((p) => ({ ...p, patron_id: e.target.value }))} style={{ width: 140, fontSize: '0.82rem' }}>
            <option value="">—</option>
            {patrones.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select></div>
          <div><div className="form-label">Desde</div><input className="form-input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ width: 120, fontSize: '0.82rem' }} /></div>
          <div><div className="form-label">Hasta</div><input className="form-input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ width: 120, fontSize: '0.82rem' }} /></div>
          <Button size="sm" onClick={handleCrear} disabled={creando}>{creando ? '...' : '+ Crear calendario'}</Button>
        </div>
      </div>

      {/* Selector de calendario + acciones */}
      <div className="card">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-input" value={calId} onChange={(e) => handleSeleccionar(e.target.value)} style={{ width: 250, fontSize: '0.82rem' }}>
            <option value="">— Seleccionar calendario —</option>
            {calendarios.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.patron?.nombre || 'sin patrón'})</option>)}
          </select>
          {calId && (
            <>
              <Button size="sm" onClick={handleRegenerar} disabled={creando}>{creando ? '...' : '🔄 Regenerar'}</Button>
              <Button size="sm" variant="ghost" onClick={handleAsignarTodos} disabled={asignando}>{asignando ? '...' : '👥 Asignar a todos'}</Button>
              <Button size="sm" variant="ghost" onClick={async () => {
                if (!window.confirm('¿Eliminar calendario?')) return
                await eliminarCalendario(calId)
                setCalId(''); setDias([])
                setCalendarios(await listarCalendarios(activeCompanyId))
              }} style={{ color: '#dc2626' }}>🗑</Button>
            </>
          )}
        </div>

        {/* Asignar empleados individualmente */}
        {calId && (
          <div style={{ marginTop: 12 }}>
            <span className="meta" style={{ fontSize: '0.78rem' }}>Asignar empleados:</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {empleados.slice(0, 20).map((e) => (
                <button key={e.id} onClick={() => handleAsignarEmp(e.id)} style={{ padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 4, background: 'transparent', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                  + {e.apellido}, {e.nombre}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Calendario visual */}
      {calId && (() => {
        const semanas = agruparSemanas(dias)
        return (
          <div className="card">
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8 }}>📅 {calendarios.find((c) => c.id === calId)?.nombre}</h3>
            {semanas.length === 0 ? <p className="meta">Sin datos. Creá el calendario primero.</p> : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <div key={d} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.72rem' }}>{d}</div>)}
                </div>
                {semanas.map((sem, si) => (
                  <div key={si} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                    {sem.map((d, di) => {
                      if (!d) return <div key={di} />
                      const color = d.turno?.color || '#e5e7eb'
                      const esExc = d.origen === 'excepcion'
                      return (
                        <div key={d.id || di} onClick={() => { setEditandoExc(d.fecha); setExcTurnoId(d.turno_id || ''); setExcMotivo('') }}
                          style={{
                            padding: 6, borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', textAlign: 'center',
                            background: d.turno_id ? color : '#f3f4f6', color: d.turno_id ? '#fff' : '#9ca3af',
                            border: esExc ? '2px solid #f59e0b' : '1px solid transparent',
                            fontWeight: 600,
                          }}>
                          {d.fecha && (() => { const p = d.fecha.split('-'); return parseInt(p[2]) })()}
                          <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>{d.turno?.codigo || 'D'}</div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Modal excepción */}
      {editandoExc && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setEditandoExc(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 360, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>⚠️ Excepción — {editandoExc}</h3>
            <p className="meta" style={{ fontSize: '0.78rem', marginBottom: 8 }}>Esta excepción aplica a TODOS los empleados asignados a este calendario. Para excepciones por empleado se agregará después.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select className="form-input" value={excTurnoId} onChange={(e) => setExcTurnoId(e.target.value)} style={{ width: '100%' }}>
                <option value="">Descanso</option>
                {turnos.map((t) => <option key={t.id} value={t.id}>{t.codigo} - {t.nombre}</option>)}
              </select>
              <input className="form-input" placeholder="Motivo" value={excMotivo} onChange={(e) => setExcMotivo(e.target.value)} style={{ width: '100%' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" onClick={() => handleExcepcion(editandoExc)}>✅ Guardar</Button>
                <Button variant="ghost" size="sm" onClick={() => setEditandoExc(null)}>Cancelar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
