import { useEffect, useState, useCallback, Fragment } from 'react'
import { useAuth, Button, Skeleton, alertError, formatearFecha } from '@saas/core'
import { generarReporteAsistencia, fmtMin } from '../data/reporteAsistencia'
import { listarEmpleados } from '../data/empleados'
import jsPDF from 'jspdf'

export function ReporteAsistenciaPage() {
  const { activeCompanyId, pais } = useAuth()
  const [empleados, setEmpleados] = useState([])
  const [empId, setEmpId] = useState('')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [desde, setDesde] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) })
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10))
  const [expandido, setExpandido] = useState(null)

  useEffect(() => {
    listarEmpleados(activeCompanyId).then(setEmpleados).catch(() => {})
  }, [activeCompanyId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await generarReporteAsistencia(activeCompanyId, desde, hasta, empId || null)
      setData(res)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId, desde, hasta, empId])

  const totalDias = data.reduce((s, r) => s + r.dias, 0)
  const totalHs = data.reduce((s, r) => s + r.hsTrab, 0)
  const totalAtrasos = data.reduce((s, r) => s + r.atrasos, 0)
  const totalExtra50 = data.reduce((s, r) => s + (r.hsExtra50 || 0), 0)
  const totalExtra100 = data.reduce((s, r) => s + (r.hsExtra100 || 0), 0)
  const totalExtra130 = data.reduce((s, r) => s + (r.hsExtra130 || 0), 0)
  const totalSalidas = data.reduce((s, r) => s + r.salidasTemprano, 0)

  function descargarCSV() {
    const BOM = '\uFEFF'
    const filas = [['Empleado', 'Días', 'Hs Trab', 'Atrasos(min)', 'HE50(min)', 'HE100(min)', 'HE130(min)', 'Salidas Temp(min)']]
    data.forEach((r) => {
      filas.push([`${r.apellido}, ${r.nombre}`, String(r.dias), fmtMin(r.hsTrab), String(r.atrasos), String(r.hsExtra50 || 0), String(r.hsExtra100 || 0), String(r.hsExtra130 || 0), String(r.salidasTemprano)])
    })
    filas.push(['Total', String(totalDias), fmtMin(totalHs), String(totalAtrasos), String(totalExtra50), String(totalExtra100), String(totalExtra130), String(totalSalidas)])
    const csv = BOM + filas.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'reporte-asistencia.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function generarPDF() {
    try {
      const doc = new jsPDF()
      let y = 20
      doc.setFontSize(16)
      doc.text('Reporte de Asistencia', 14, y)
      y += 10
      doc.setFontSize(10)
      doc.text('Periodo: ' + formatearFecha(desde, pais) + ' al ' + formatearFecha(hasta, pais), 14, y)
      y += 10

      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('Empleado', 14, y)
      doc.text('Dias', 60, y)
      doc.text('Hs Trab', 78, y)
      doc.text('Atrasos', 98, y)
      doc.text('HE50', 118, y)
      doc.text('HE100', 136, y)
      doc.text('HE130', 154, y)
      y += 7

      doc.setFont('helvetica', 'normal')
      data.forEach((r) => {
        if (y > 270) { doc.addPage(); y = 20 }
        const nombre = (r.apellido || '') + ', ' + (r.nombre || '')
        doc.text(String(nombre).substring(0, 20), 14, y)
        doc.text(String(r.dias), 66, y, { align: 'right' })
        doc.text(fmtMin(r.hsTrab), 84, y, { align: 'right' })
        doc.text(r.atrasos > 0 ? r.atrasos + '' : '-', 104, y, { align: 'right' })
        doc.text(String(r.hsExtra50 || 0), 124, y, { align: 'right' })
        doc.text(String(r.hsExtra100 || 0), 142, y, { align: 'right' })
        doc.text(String(r.hsExtra130 || 0), 160, y, { align: 'right' })
        y += 6
      })

      doc.save('reporte-asistencia.pdf')
    } catch (err) {
      alertError('Error al generar PDF', err.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📊 Reporte de asistencia</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" onClick={descargarCSV} disabled={data.length === 0}>📥 CSV</Button>
            <Button size="sm" onClick={generarPDF} disabled={data.length === 0}>📥 PDF</Button>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          <div><div className="meta" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Desde</div>
            <input className="form-input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ width: 130, fontSize: '0.82rem' }} />
          </div>
          <div><div className="meta" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Hasta</div>
            <input className="form-input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ width: 130, fontSize: '0.82rem' }} />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <select className="form-input" value={empId} onChange={(e) => setEmpId(e.target.value)} style={{ width: 200, fontSize: '0.82rem' }}>
              <option value="">Todos los empleados</option>
              {empleados.map((e) => <option key={e.id} value={e.id}>{e.apellido}, {e.nombre}</option>)}
            </select>
          </div>
          <Button size="sm" onClick={load} style={{ alignSelf: 'flex-end' }}>📊 Generar</Button>
        </div>

      {loading ? <Skeleton.Card /> : data.length === 0 ? (
        <div className="card"><p className="meta" style={{ padding: 24, textAlign: 'center' }}>Sin datos. Seleccioná un período y hacé click en Generar.</p></div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th style={{ textAlign: 'right' }}>Días</th>
                  <th style={{ textAlign: 'right' }}>Hs. trabajadas</th>
                  <th style={{ textAlign: 'right', color: '#d97706' }}>Atrasos</th>
                  <th style={{ textAlign: 'right', color: '#16a34a' }}>HE50</th>
                  <th style={{ textAlign: 'right', color: '#059669' }}>HE100</th>
                  <th style={{ textAlign: 'right', color: '#7c3aed' }}>HE130</th>
                  <th style={{ textAlign: 'right' }}>Salidas temp.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <Fragment key={r.id}>
                    <tr key={r.id}>
                      <td data-label="Empleado" style={{ fontWeight: 600 }}>{r.apellido}, {r.nombre}</td>
                      <td data-label="Días" style={{ textAlign: 'right' }}>{r.dias}</td>
                      <td data-label="Hs. trab" style={{ textAlign: 'right', fontWeight: 600 }}>{fmtMin(r.hsTrab)}</td>
                      <td data-label="Atrasos" style={{ textAlign: 'right', color: r.atrasos > 0 ? '#d97706' : '#16a34a', fontWeight: 600 }}>
                        {r.atrasos > 0 ? fmtMin(r.atrasos) : '—'}
                      </td>
                      <td data-label="HE50" style={{ textAlign: 'right', color: r.hsExtra50 > 0 ? '#16a34a' : '#6b7280' }}>
                        {(r.hsExtra50 || 0) > 0 ? fmtMin(r.hsExtra50) : '—'}
                      </td>
                      <td data-label="HE100" style={{ textAlign: 'right', color: r.hsExtra100 > 0 ? '#059669' : '#6b7280' }}>
                        {(r.hsExtra100 || 0) > 0 ? fmtMin(r.hsExtra100) : '—'}
                      </td>
                      <td data-label="HE130" style={{ textAlign: 'right', color: r.hsExtra130 > 0 ? '#7c3aed' : '#6b7280' }}>
                        {(r.hsExtra130 || 0) > 0 ? fmtMin(r.hsExtra130) : '—'}
                      </td>
                      <td data-label="Salidas temp" style={{ textAlign: 'right' }}>{r.salidasTemprano > 0 ? fmtMin(r.salidasTemprano) : '—'}</td>
                      <td data-label="">{/* expand button */}
                        <button onClick={() => setExpandido(expandido === r.id ? null : r.id)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.82rem' }}>
                          {expandido === r.id ? '▲' : '▼'} Detalle
                        </button>
                      </td>
                    </tr>
                    {expandido === r.id && r.detalle.length > 0 && (
                      <tr key={`det-${r.id}`}>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <div style={{ padding: 12, background: '#f9fafb' }}>
                            <table className="table" style={{ fontSize: '0.78rem' }}>
                              <thead>
                                <tr>
                                  <th>Fecha</th>
                                  <th>Entrada</th>
                                  <th>Plan.</th>
                                  <th style={{ textAlign: 'right' }}>Atraso</th>
                                  <th>Salida</th>
                                  <th>Plan.</th>
                                  <th style={{ textAlign: 'right' }}>HE50</th>
                                  <th style={{ textAlign: 'right' }}>HE100</th>
                                  <th style={{ textAlign: 'right' }}>HE130</th>
                                  <th style={{ textAlign: 'right' }}>Noct.</th>
                                  <th style={{ textAlign: 'right' }}>Hs</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.detalle.map((d, i) => (
                                  <tr key={i}>
                                    <td data-label="Fecha" className="meta">{formatearFecha(d.fecha, pais)}</td>
                                    <td data-label="Entrada" style={{ fontFamily: 'monospace' }}>{d.entrada || '—'}</td>
                                    <td data-label="Plan" className="meta">{d.esperadaEntrada || '—'}</td>
                                    <td data-label="Atraso" style={{ textAlign: 'right', color: d.atraso > 0 ? '#d97706' : '#16a34a' }}>
                                      {d.atraso > 0 ? fmtMin(d.atraso) : '✓'}
                                    </td>
                                    <td data-label="Salida" style={{ fontFamily: 'monospace' }}>{d.salida || '—'}</td>
                                    <td data-label="Plan" className="meta">{d.esperadaSalida || '—'}</td>
                                    <td data-label="HE50" style={{ textAlign: 'right', color: d.hsExtra50 > 0 ? '#16a34a' : '#6b7280' }}>
                                      {d.hsExtra50 > 0 ? fmtMin(d.hsExtra50) : '—'}
                                    </td>
                                    <td data-label="HE100" style={{ textAlign: 'right', color: d.hsExtra100 > 0 ? '#059669' : '#6b7280' }}>
                                      {d.hsExtra100 > 0 ? fmtMin(d.hsExtra100) : '—'}
                                    </td>
                                    <td data-label="HE130" style={{ textAlign: 'right', color: d.hsExtra130 > 0 ? '#7c3aed' : '#6b7280' }}>
                                      {d.hsExtra130 > 0 ? fmtMin(d.hsExtra130) : '—'}
                                    </td>
                                    <td data-label="Noct" style={{ textAlign: 'right', color: ' #6b7280' }}>—</td>
                                    <td data-label="Hs" style={{ textAlign: 'right', fontWeight: 600 }}>{d.hsTrab > 0 ? fmtMin(d.hsTrab) : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
                  <td data-label="">Total ({data.length} empleados)</td>
                  <td data-label="Días" style={{ textAlign: 'right' }}>{totalDias}</td>
                  <td data-label="Hs. trab" style={{ textAlign: 'right' }}>{fmtMin(totalHs)}</td>
                  <td data-label="Atrasos" style={{ textAlign: 'right', color: totalAtrasos > 0 ? '#d97706' : '#16a34a' }}>{totalAtrasos > 0 ? fmtMin(totalAtrasos) : '—'}</td>
                  <td data-label="HE50" style={{ textAlign: 'right', color: totalExtra50 > 0 ? '#16a34a' : '#6b7280' }}>{totalExtra50 > 0 ? fmtMin(totalExtra50) : '—'}</td>
                  <td data-label="HE100" style={{ textAlign: 'right', color: totalExtra100 > 0 ? '#059669' : '#6b7280' }}>{totalExtra100 > 0 ? fmtMin(totalExtra100) : '—'}</td>
                  <td data-label="HE130" style={{ textAlign: 'right', color: totalExtra130 > 0 ? '#7c3aed' : '#6b7280' }}>{totalExtra130 > 0 ? fmtMin(totalExtra130) : '—'}</td>
                  <td data-label="Salidas temp" style={{ textAlign: 'right' }}>{totalSalidas > 0 ? fmtMin(totalSalidas) : '—'}</td>
                  <td data-label=""></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
