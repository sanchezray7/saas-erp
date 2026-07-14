import { useEffect, useState } from 'react'
import { useAuth, Button, Skeleton, alertError, notify } from '@saas/core'
import { listarEmpleados, listarContratos } from '../data/empleados'
import { calcularControl, listarControlResumen } from '../data/controlHorario'

export function ControlHorarioPage() {
  const { activeCompanyId } = useAuth()
  const hoy = new Date()
  const [empleados, setEmpleados] = useState([])
  const [deptos, setDeptos] = useState([])
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [calculando, setCalculando] = useState(false)
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 })
  const [desde, setDesde] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) })
  const [hasta, setHasta] = useState(() => hoy.toISOString().slice(0, 10))
  const [filtroEmp, setFiltroEmp] = useState('')
  const [filtroDepto, setFiltroDepto] = useState('')
  const [expandido, setExpandido] = useState(null)

  useEffect(() => {
    listarEmpleados(activeCompanyId).then((emps) => {
      setEmpleados(emps)
      // Extraer departamentos únicos desde contratos activos
      Promise.all(emps.map((e) => listarContratos(e.id).catch(() => []))).then((contratosArr) => {
        const deptosSet = new Set()
        contratosArr.flat().filter((c) => c.activo !== false).forEach((c) => {
          if (c.departamento?.nombre) deptosSet.add(c.departamento.nombre)
        })
        setDeptos([...deptosSet].sort())
      }).catch(() => {})
    }).catch(() => {}).finally(() => setLoading(false))
  }, [activeCompanyId])

  async function handleCalcular() {
    setCalculando(true); setProgreso({ actual: 0, total: 0 })
    try {
      // Determinar empleados a procesar
      let ids = [filtroEmp].filter(Boolean)
      if (!filtroEmp) {
        ids = empleados.map((e) => e.id)
      }

      setProgreso((p) => ({ ...p, total: ids.length }))
      for (let i = 0; i < ids.length; i++) {
        await calcularControl(activeCompanyId, desde, hasta, ids[i])
        setProgreso({ actual: i + 1, total: ids.length })
      }
      notify(`Control calculado para ${ids.length} empleado(s)`)
      await cargar()
    } catch (err) { alertError('Error', err.message) }
    finally { setCalculando(false) }
  }

  async function cargar() {
    setRefreshing(true)
    const res = await listarControlResumen(activeCompanyId, desde, hasta, filtroEmp || null).catch(() => [])
    setData(filtroDepto ? filtrados : res)
    setRefreshing(false)
  }

  useEffect(() => { if (!calculando) cargar() }, [activeCompanyId, desde, hasta, filtroEmp])

  function fmtMin(m) {
    if (m == null || m === 0) return '—'
    const signo = m < 0 ? '-' : ''
    const abs = Math.abs(m)
    const h = Math.floor(abs / 60)
    const min = abs % 60
    return `${signo}${h}h ${String(min).padStart(2, '0')}min`
  }

  if (loading) return <Skeleton.Card />

  const pct = progreso.total > 0 ? Math.round((progreso.actual / progreso.total) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📊 Control Horario</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {calculando && (
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2563eb' }}>
                Procesando {progreso.actual}/{progreso.total} · {pct}%
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 8 }}>
          <div><div className="form-label">Desde</div><input className="form-input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ width: 120, fontSize: '0.82rem' }} /></div>
          <div><div className="form-label">Hasta</div><input className="form-input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ width: 120, fontSize: '0.82rem' }} /></div>
          <div><div className="form-label">Empleado</div>
            <select className="form-input" value={filtroEmp} onChange={(e) => setFiltroEmp(e.target.value)} style={{ width: 180, fontSize: '0.82rem' }}>
              <option value="">Todos</option>
              {empleados.map((e) => <option key={e.id} value={e.id}>{e.apellido}, {e.nombre}</option>)}
            </select>
          </div>
          {deptos.length > 0 && (
            <div><div className="form-label">Departamento</div>
              <select className="form-input" value={filtroDepto} onChange={(e) => setFiltroDepto(e.target.value)} style={{ width: 140, fontSize: '0.82rem' }}>
                <option value="">Todos</option>
                {deptos.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          <Button size="sm" onClick={handleCalcular} disabled={calculando}>{calculando ? 'Calculando...' : '🔁 Calcular'}</Button>
        </div>

        {/* Barra de progreso */}
        {calculando && (
          <div style={{ width: '100%', height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#2563eb', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <div className="card"><p className="meta" style={{ padding: 24, textAlign: 'center' }}>{refreshing ? 'Cargando...' : 'Sin datos. Hacé clic en Calcular para procesar el período.'}</p></div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th style={{ textAlign: 'right' }}>Días</th>
                  <th style={{ textAlign: 'right' }}>Hs. totales</th>
                  <th style={{ textAlign: 'right', color: '#d97706' }}>Atrasos</th>
                  <th style={{ textAlign: 'right', color: '#16a34a' }}>HE50</th>
                  <th style={{ textAlign: 'right', color: '#059669' }}>HE100</th>
                  <th style={{ textAlign: 'right', color: '#7c3aed' }}>HE130</th>
                  <th style={{ textAlign: 'right', color: '#6366f1' }}>Noct.</th>
                  <th style={{ textAlign: 'right', color: '#dc2626' }}>Aus.</th>
                  <th style={{ textAlign: 'right', color: '#9ca3af' }}>Desc.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                  {data.map((g) => (
                   <tr key={g.empleado_id}>
                    <td data-label="Empleado" style={{ fontWeight: 600 }}>{g.nombre}</td>
                    <td data-label="Días" style={{ textAlign: 'right' }}>{g.dias}</td>
                    <td data-label="Hs. totales" style={{ textAlign: 'right', fontWeight: 600 }}>{fmtMin(g.total_hs)}</td>
                    <td data-label="Atrasos" style={{ textAlign: 'right', color: g.total_atraso > 0 ? '#d97706' : '#16a34a' }}>{g.total_atraso > 0 ? fmtMin(g.total_atraso) : '—'}</td>
                    <td data-label="HE50" style={{ textAlign: 'right', color: g.total_extra_50 > 0 ? '#16a34a' : '#6b7280' }}>{g.total_extra_50 > 0 ? fmtMin(g.total_extra_50) : '—'}</td>
                    <td data-label="HE100" style={{ textAlign: 'right', color: g.total_extra_100 > 0 ? '#059669' : '#6b7280' }}>{g.total_extra_100 > 0 ? fmtMin(g.total_extra_100) : '—'}</td>
                    <td data-label="HE130" style={{ textAlign: 'right', color: g.total_extra_130 > 0 ? '#7c3aed' : '#6b7280' }}>{g.total_extra_130 > 0 ? fmtMin(g.total_extra_130) : '—'}</td>
                    <td data-label="Noct." style={{ textAlign: 'right', color: g.total_nocturno > 0 ? '#6366f1' : '#6b7280' }}>{g.total_nocturno > 0 ? fmtMin(g.total_nocturno) : '—'}</td>
                    <td data-label="Ausencias" style={{ textAlign: 'right', color: g.ausencias > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{g.ausencias > 0 ? g.ausencias : '0'}</td>
                    <td data-label="Descansos" style={{ textAlign: 'right', color: '#9ca3af' }}>{g.descansos || 0}</td>
                    <td>
                      <button onClick={() => setExpandido(expandido === g.empleado_id ? null : g.empleado_id)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.82rem' }}>
                        {expandido === g.empleado_id ? '▲' : '▼'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detalle expandible */}
          {expandido && (() => {
            const g = data.find((d) => d.empleado_id === expandido)
            if (!g) return null
            return (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8 }}>📋 {g.nombre} — detalle diario</h4>
                <div className="table-wrapper">
                  <table className="table" style={{ fontSize: '0.78rem' }}>
                    <thead>
                      <tr><th>Fecha</th><th>Planificado</th><th>Real</th><th style={{ textAlign: 'right' }}>Hs</th><th style={{ textAlign: 'right' }}>Atraso</th><th style={{ textAlign: 'right' }}>HE50</th><th style={{ textAlign: 'right' }}>HE100</th><th style={{ textAlign: 'right' }}>HE130</th><th style={{ textAlign: 'right' }}>Noct.</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {g.detalle.map((d) => {
                        const plan = d.entrada_planificada && d.salida_planificada
                          ? `${d.entrada_planificada.slice(0, 5)}-${d.salida_planificada.slice(0, 5)}`
                          : `${d.turno_planificado || '—'}`
                        const real = d.entrada_real && d.salida_real
                          ? `${d.entrada_real.slice(0, 5)}-${d.salida_real.slice(0, 5)}`
                          : d.es_ausente ? '❌ Ausente' : '—'
                        return (
                          <tr key={d.id}>
                            <td data-label="Fecha" className="meta">{d.fecha?.slice(0, 10)}</td>
                            <td data-label="Planificado" style={{ fontFamily: 'monospace' }}>{plan}</td>
                            <td data-label="Real" style={{ fontFamily: 'monospace', color: d.es_ausente ? '#dc2626' : undefined }}>{real}</td>
                            <td data-label="Hs" style={{ textAlign: 'right' }}>{fmtMin(d.minutos_trabajados)}</td>
                            <td data-label="Atraso" style={{ textAlign: 'right', color: d.minutos_atraso > 0 ? '#d97706' : '#16a34a' }}>{d.minutos_atraso > 0 ? fmtMin(d.minutos_atraso) : '✓'}</td>
                            <td data-label="HE50" style={{ textAlign: 'right', color: d.minutos_extra_50 > 0 ? '#16a34a' : '#6b7280' }}>{d.minutos_extra_50 > 0 ? fmtMin(d.minutos_extra_50) : '—'}</td>
                            <td data-label="HE100" style={{ textAlign: 'right', color: d.minutos_extra_100 > 0 ? '#059669' : '#6b7280' }}>{d.minutos_extra_100 > 0 ? fmtMin(d.minutos_extra_100) : '—'}</td>
                            <td data-label="HE130" style={{ textAlign: 'right', color: d.minutos_extra_130 > 0 ? '#7c3aed' : '#6b7280' }}>{d.minutos_extra_130 > 0 ? fmtMin(d.minutos_extra_130) : '—'}</td>
                            <td data-label="Noct." style={{ textAlign: 'right', color: d.minutos_nocturnos > 0 ? '#6366f1' : '#6b7280' }}>{d.minutos_nocturnos > 0 ? fmtMin(d.minutos_nocturnos) : '—'}</td>
                            <td data-label="Estado">{d.es_feriado ? <span className="badge" style={{ background: '#ede9fe', color: '#7c3aed' }}>🏖 Feriado</span> : d.motivo_ausencia ? <span className="badge" style={{ background: '#fef3c7', color: '#d97706' }}>{d.motivo_ausencia}</span> : d.es_ausente ? <span className="badge" style={{ background: '#fef2f2', color: '#dc2626' }}>Ausente</span> : d.turno_planificado && !d.entrada_real ? <span className="badge" style={{ background: '#fef3c7', color: '#d97706' }}>Sin marcar</span> : !d.turno_planificado && !d.entrada_real ? <span className="badge" style={{ background: '#f5f5f5', color: '#9ca3af' }}>Descanso</span> : <span className="badge" style={{ background: '#dcfce7', color: '#16a34a' }}>✅</span>}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
