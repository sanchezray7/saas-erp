import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, alertError, notify } from '@saas/core'
import { listarDispositivos, guardarDispositivo, previsualizarMarcaciones, procesarMarcaciones } from '../data/biometrico'
import { listarEmpleados } from '../data/empleados'

export function ImportarAsistenciaPage() {
  const { activeCompanyId } = useAuth()
  const [dispositivos, setDispositivos] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [dispId, setDispId] = useState('')
  const [umbral, setUmbral] = useState(3)
  const [minimo, setMinimo] = useState(30)
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState([])
  const [procesando, setProcesando] = useState(false)
  const [loading, setLoading] = useState(true)
  const [nuevoDisp, setNuevoDisp] = useState('')

  useEffect(() => {
    Promise.all([
      listarDispositivos(activeCompanyId).catch(() => []),
      listarEmpleados(activeCompanyId).catch(() => []),
    ]).then(([d, e]) => {
      setDispositivos(d); setEmpleados(e)
    }).finally(() => setLoading(false))
  }, [activeCompanyId])

  async function handleCrearDispositivo() {
    if (!nuevoDisp.trim()) { alertError('Error', 'Nombre requerido'); return }
    try {
      const id = await guardarDispositivo(activeCompanyId, { nombre: nuevoDisp.trim() })
      setDispId(id)
      setNuevoDisp('')
      setDispositivos(await listarDispositivos(activeCompanyId))
      notify('Dispositivo creado')
    } catch (err) { alertError('Error', err.message) }
  }

  function handlePrevisualizar() {
    if (!csvText.trim()) { alertError('Error', 'Pegá las marcaciones del CSV'); return }
    const res = previsualizarMarcaciones(activeCompanyId, csvText, umbral, minimo)
    setPreview(res)
  }

  function badgeColor(tipo) {
    if (tipo === 'entrada') return { bg: '#dcfce7', color: '#16a34a' }
    if (tipo === 'salida') return { bg: '#e0f2fe', color: '#0284c7' }
    if (tipo === 'salida_almuerzo' || tipo === 'entrada_almuerzo') return { bg: '#fef3c7', color: '#d97706' }
    if (tipo?.startsWith('pre_')) return { bg: '#f5f5f5', color: '#9ca3af' }
    return { bg: '#fef2f2', color: '#dc2626' }
  }

  const codeMap = {}
  const codeMapId = {}
  empleados.forEach((e) => {
    if (e.codigo_biometrico) {
      const key = e.codigo_biometrico.trim().toLowerCase()
      codeMap[key] = e
      codeMapId[key] = e.id
    }
  })

  async function handleProcesar() {
    if (!dispId) { alertError('Error', 'Seleccioná un dispositivo'); return }
    setProcesando(true)
    try {
      const res = await procesarMarcaciones(activeCompanyId, dispId, csvText, umbral, minimo, codeMapId)
      if (res.procesados === 0 && res.sinVincular > 0) {
        alertError('Error', `${res.sinVincular} empleado(s) sin vincular. Asignales código biométrico en su ficha y volvé a intentar.`)
      } else {
        notify(`${res.procesados} marcación(es) procesada(s)`)
      }
      if (res.sinVincular > 0 && res.procesados > 0) {
        alertError('Atención', `${res.sinVincular} empleado(s) sin vincular. Revisá los códigos biométricos.`)
      }
      setPreview([])
      setCsvText('')
    } catch (err) { alertError('Error', err.message) }
    finally { setProcesando(false) }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📥 Importar marcaciones</h1>
          <Link to="/asistencia"><Button variant="ghost" size="sm">Volver a Asistencia</Button></Link>
        </div>
      </div>

      {/* Configuración */}
      <div className="card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>⚙️ Dispositivo y parámetros</h3>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            <div>
              <div className="form-label">Dispositivo</div>
              <select className="form-input" value={dispId} onChange={(e) => setDispId(e.target.value)} style={{ width: '100%', fontSize: '0.82rem' }}>
                <option value="">— Seleccionar —</option>
                {dispositivos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: dispositivos.length > 0 ? undefined : 'span 2' }}>
              <div className="form-label">O crear nuevo</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input className="form-input" placeholder="Nombre del dispositivo" value={nuevoDisp} onChange={(e) => setNuevoDisp(e.target.value)} style={{ flex: 1, fontSize: '0.82rem' }} />
                {nuevoDisp.trim() && <Button size="sm" onClick={handleCrearDispositivo}>Crear</Button>}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginTop: 10 }}>
            <div>
              <div className="form-label">Umbral nueva jornada (hs)</div>
              <input className="form-input" type="number" min="1" step="0.5" value={umbral} onChange={(e) => setUmbral(Number(e.target.value))} style={{ width: '100%', fontSize: '0.82rem' }} />
            </div>
            <div>
              <div className="form-label">Mínimo por jornada (min)</div>
              <input className="form-input" type="number" min="1" step="5" value={minimo} onChange={(e) => setMinimo(Number(e.target.value))} style={{ width: '100%', fontSize: '0.82rem' }} />
            </div>
          </div>
        </div>
      </div>

      {/* CSV */}
      <div className="card">
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8 }}>📄 Datos del dispositivo</h3>
        <p className="meta" style={{ fontSize: '0.78rem', marginBottom: 8 }}>
          Pegá las marcaciones copiadas del reloj. Formato: <strong>código,fecha,hora</strong> (o código,fecha,hora,tipo si el dispositivo envía tipo explícito).
        </p>
        <textarea className="form-input" rows={8} value={csvText} onChange={(e) => setCsvText(e.target.value)}
          placeholder={`EMP001,2026-07-10,07:55\nEMP001,2026-07-10,15:00\nEMP001,2026-07-10,20:00\nEMP001,2026-07-11,06:00`}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.82rem' }} />
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <Button size="sm" onClick={handlePrevisualizar} disabled={!csvText.trim()}>📋 Previsualizar</Button>
          {preview.length > 0 && (
            <Button size="sm" onClick={handleProcesar} disabled={procesando}>
              {procesando ? 'Procesando...' : '✅ Procesar e importar'}
            </Button>
          )}
        </div>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="card">
          <div className="page-header" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>📋 Vista previa ({preview.length} marcaciones)</h3>
            <span className="meta">{preview.filter((m) => m.tipo?.startsWith('pre_')).length} pre-entradas no se importarán</span>
          </div>
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Empleado</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>Duración</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((m, i) => {
                  const emp = codeMap[m.codigo.trim().toLowerCase()]
                  const badge = badgeColor(m.tipo)
                  const esPre = m.tipo?.startsWith('pre_')
                  return (
                    <tr key={i} style={{ opacity: esPre ? 0.5 : 1 }}>
                      <td data-label="Código" style={{ fontWeight: 600, fontFamily: 'monospace' }}>{m.codigo}</td>
                      <td data-label="Empleado">{emp ? `${emp.apellido}, ${emp.nombre}` : <span style={{ color: '#dc2626' }}>❌ No vinculado</span>}</td>
                      <td data-label="Fecha" className="meta">{m.fecha}</td>
                      <td data-label="Hora" style={{ fontFamily: 'monospace' }}>{m.hora}</td>
                      <td data-label="Tipo"><span className="badge" style={{ background: badge.bg, color: badge.color }}>{m.tipo}</span></td>
                      <td data-label="Duración" className="meta">{m.duracionMin ? `${m.duracionMin} min` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {preview.filter((m) => !codeMap[m.codigo.trim().toLowerCase()] && !m.tipo?.startsWith('pre_')).length > 0 && (
            <p className="meta" style={{ marginTop: 12, fontSize: '0.78rem', color: '#dc2626' }}>
              ❌ Hay empleados sin vincular. Asignales el código biométrico en la ficha de cada empleado (campo "Código en reloj biométrico").
            </p>
          )}
        </div>
      )}
    </div>
  )
}
