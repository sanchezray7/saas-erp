import { useEffect, useState } from 'react'
import { useAuth, Button, Skeleton, alertError, notify, getSupabase } from '@saas/core'
import { listarAsistencia, marcarAsistencia, listarAusenciasEmpleado, listarVacacionesEmpleado } from '../data/asistencia'
import { listarFeriados } from '../data/feriados'
import { listarEmpleados } from '../data/empleados'

export function AsistenciaPage() {
  const { activeCompanyId } = useAuth()
  const hoy = new Date()
  const [empleados, setEmpleados] = useState([])
  const [empId, setEmpId] = useState('')
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [data, setData] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [vacaciones, setVacaciones] = useState([])
  const [feriados, setFeriados] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // { fecha, registro? }
  const [horaEntrada, setHoraEntrada] = useState('')
  const [horaSalida, setHoraSalida] = useState('')
  const [marcando, setMarcando] = useState(false)

  useEffect(() => {
    listarEmpleados(activeCompanyId).then(setEmpleados).catch(() => {})
  }, [activeCompanyId])

  useEffect(() => {
    if (!empId) { setLoading(false); return }
    setLoading(true)
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
    const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10)
    Promise.all([
      listarAsistencia(activeCompanyId, empId, mes, anio),
      listarAusenciasEmpleado(activeCompanyId, empId, desde, hasta),
      listarVacacionesEmpleado(activeCompanyId, empId, desde, hasta),
      listarFeriados(activeCompanyId, anio),
    ])
      .then(([asis, aus, vac, fer]) => { setData(asis); setAusencias(aus); setVacaciones(vac); setFeriados(fer) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [activeCompanyId, empId, mes, anio])

  const diasDelMes = new Date(anio, mes, 0).getDate()
  const primerDia = new Date(anio, mes - 1, 1).getDay()

  // Build map: fecha → merged info
  const asisMap = {}
  data.forEach((a) => { asisMap[a.fecha] = { ...a } })
  ausencias.forEach((a) => {
    const inicio = new Date(a.fecha_inicio)
    const fin = new Date(a.fecha_fin)
    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10)
      if (!asisMap[key]) asisMap[key] = {}
      asisMap[key]._ausencia = a.tipo?.nombre || 'Ausencia'
    }
  })
  vacaciones.forEach((v) => {
    const inicio = new Date(v.fecha_inicio)
    const fin = new Date(v.fecha_fin)
    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10)
      if (!asisMap[key]) asisMap[key] = {}
      asisMap[key]._vacaciones = true
    }
  })
  feriados.forEach((f) => {
    if (!asisMap[f.fecha]) asisMap[f.fecha] = {}
    asisMap[f.fecha]._feriado = f.nombre
  })

  function abrirModal(fecha) {
    const reg = asisMap[fecha]
    setHoraEntrada(reg?.hora_entrada?.slice(0, 5) || '')
    setHoraSalida(reg?.hora_salida?.slice(0, 5) || '')
    setModal({ fecha, registro: reg || null })
  }

  async function handleMarcar() {
    if (!empId) { alertError('Error', 'Seleccioná un empleado'); return }
    setMarcando(true)
    try {
      await marcarAsistencia(activeCompanyId, empId, {
        fecha: modal.fecha, hora_entrada: horaEntrada || null, hora_salida: horaSalida || null,
        tipo: 'normal',
      })
      notify(`Asistencia registrada para ${modal.fecha}`)
      setModal(null)
      const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
      const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10)
      const [asis, aus, vac, fer] = await Promise.all([
        listarAsistencia(activeCompanyId, empId, mes, anio),
        listarAusenciasEmpleado(activeCompanyId, empId, desde, hasta),
        listarVacacionesEmpleado(activeCompanyId, empId, desde, hasta),
        listarFeriados(activeCompanyId, anio),
      ])
      setData(asis); setAusencias(aus); setVacaciones(vac); setFeriados(fer)
    } catch (err) { alertError('Error', err.message) }
    finally { setMarcando(false) }
  }

  const cellStyle = (fecha) => {
    const r = asisMap[fecha]
    if (r?.hora_entrada) return { minHeight: 60, padding: 4, borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', background: '#dcfce7', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 2 }
    if (r?._feriado) return { minHeight: 60, padding: 4, borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', background: '#ede9fe', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 2 }
    if (r?._vacaciones) return { minHeight: 60, padding: 4, borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', background: '#fefce8', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 2 }
    if (r?._ausencia) return { minHeight: 60, padding: 4, borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', background: '#fef3c7', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 2 }
    if (r?.tipo === 'ausente') return { minHeight: 60, padding: 4, borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', background: '#fef2f2', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 2 }
    return { minHeight: 60, padding: 4, borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', background: '#f9fafb', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 2 }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📅 Asistencia</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <select className="form-input" value={empId} onChange={(e) => setEmpId(e.target.value)} style={{ width: 220, fontSize: '0.82rem' }}>
            <option value="">— Seleccionar empleado —</option>
            {empleados.map((e) => <option key={e.id} value={e.id}>{e.apellido}, {e.nombre}</option>)}
          </select>
          <select className="form-input" value={mes} onChange={(e) => setMes(Number(e.target.value))} style={{ width: 120, fontSize: '0.82rem' }}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][i]}</option>)}
          </select>
          <input className="form-input" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ width: 80, fontSize: '0.82rem' }} />
        </div>
      </div>

      {!empId ? (
        <div className="card"><p className="meta" style={{ padding: 24, textAlign: 'center' }}>Seleccioná un empleado para ver su asistencia</p></div>
      ) : loading ? <Skeleton.Card /> : (
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center', fontWeight: 700, fontSize: '0.78rem', marginBottom: 4 }}>
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: primerDia }, (_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: diasDelMes }, (_, i) => {
              const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
              const reg = asisMap[fecha]
              return (
                <div key={fecha} style={cellStyle(fecha)} onClick={() => abrirModal(fecha)}>
                  <div style={{ fontWeight: 700, fontSize: '0.78rem' }}>{i + 1}</div>
                  {reg?.hora_entrada && <div style={{ color: '#16a34a' }}>🟢 {reg.hora_entrada.slice(0, 5)}</div>}
                  {reg?.hora_salida && <div style={{ color: '#6b7280' }}>🔴 {reg.hora_salida.slice(0, 5)}</div>}
                  {reg?.tipo === 'ausente' && <div style={{ color: '#dc2626' }}>❌ Ausente</div>}
                  {reg?._feriado && <div style={{ color: '#7c3aed' }}>🏖 {reg._feriado}</div>}
                  {reg?._ausencia && <div style={{ color: '#d97706' }}>🏖 {reg._ausencia}</div>}
                  {reg?._vacaciones && <div style={{ color: '#ca8a04' }}>🌴 Vacaciones</div>}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: '0.75rem', color: '#6b7280', flexWrap: 'wrap' }}>
            <span>🟢 Presente</span>
            <span>❌ Ausente</span>
            <span>🏖 Feriado</span>
            <span>🏖 Ausencia aprobada</span>
            <span>🌴 Vacaciones</span>
            <span>⬜ Sin novedad</span>
          </div>
        </div>
      )}

      {/* Modal marcación */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setModal(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 360, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>📅 {modal.fecha}</h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {asisMap[modal.fecha]?._feriado && <div style={{ fontSize: '0.82rem', color: '#7c3aed', fontWeight: 600 }}>🏖 {asisMap[modal.fecha]._feriado}</div>}
              {asisMap[modal.fecha]?._ausencia && <div style={{ fontSize: '0.82rem', color: '#d97706', fontWeight: 600 }}>🏖 {asisMap[modal.fecha]._ausencia}</div>}
              {asisMap[modal.fecha]?._vacaciones && <div style={{ fontSize: '0.82rem', color: '#ca8a04', fontWeight: 600 }}>🌴 Vacaciones</div>}
              <div>
                <div className="meta" style={{ fontSize: '0.75rem', marginBottom: 2 }}>Hora entrada</div>
                <input className="form-input" type="time" value={horaEntrada} onChange={(e) => setHoraEntrada(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div>
                <div className="meta" style={{ fontSize: '0.75rem', marginBottom: 2 }}>Hora salida</div>
                <input className="form-input" type="time" value={horaSalida} onChange={(e) => setHoraSalida(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" onClick={handleMarcar} disabled={marcando}>{marcando ? '...' : '✅ Marcar'}</Button>
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!empId) return
                  await marcarAsistencia(activeCompanyId, empId, { fecha: modal.fecha, tipo: 'ausente' })
                  notify('Marcado como ausente')
                  setModal(null)
                  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
                  const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10)
                  const [asis, aus, vac, fer] = await Promise.all([
                    listarAsistencia(activeCompanyId, empId, mes, anio),
                    listarAusenciasEmpleado(activeCompanyId, empId, desde, hasta),
                    listarVacacionesEmpleado(activeCompanyId, empId, desde, hasta),
                    listarFeriados(activeCompanyId, anio),
                  ])
                  setData(asis); setAusencias(aus); setVacaciones(vac); setFeriados(fer)
                }}>❌ Ausente</Button>
                <Button variant="ghost" size="sm" onClick={() => setModal(null)}>Cancelar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
