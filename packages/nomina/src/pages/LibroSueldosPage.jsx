import { useEffect, useState } from 'react'
import { useAuth, Button, Skeleton, alertError, PERMISSIONS } from '@saas/core'
import { listarPeriodos, fmtMonto } from '../data/periodos'
import { obtenerLibroSueldos } from '../data/libroSueldos'
import jsPDF from 'jspdf'
import { applyPlugin } from 'jspdf-autotable'
applyPlugin(jsPDF)

export function LibroSueldosPage() {
  const { activeCompanyId, can } = useAuth()
  const [periodos, setPeriodos] = useState([])
  const [periodoId, setPeriodoId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!activeCompanyId) return
    listarPeriodos(activeCompanyId).then(setPeriodos).catch(() => {})
  }, [activeCompanyId])

  async function handleLoad() {
    if (!periodoId) return
    setLoading(true)
    setLoaded(false)
    try {
      const res = await obtenerLibroSueldos(periodoId, activeCompanyId)
      setData(res)
      setLoaded(true)
    } catch (_) {}
    setLoading(false)
  }

  function descargarCSV() {
    if (!data || data.filas.length === 0) return
    const cabeceras = ['N°', 'Apellido y Nombre', 'C.I.', 'N° IPS', 'Cargo', 'Fecha Ingreso', 'Días', 'Salario', 'Remunerativo', 'HE', 'Vacaciones', 'Aguinaldo', 'IPS Aporte', 'Otras Ded.', 'Neto']
    const lines = [cabeceras.join(';')]
    data.filas.forEach((f, i) => {
      const row = [
        i + 1, f.nombre, f.ci, f.numero_ips, f.cargo, f.fecha_ingreso,
        f.dias, f.salario, f.remunerativo, f.he, f.vacaciones, f.aguinaldo,
        f.ips, f.otras_deducciones, f.neto,
      ]
      lines.push(row.map((v) => String(v ?? '').replace(/;|"/g, '')).join(';'))
    })
    const bom = '\uFEFF'
    const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `libro-sueldos-${data.periodo?.nombre || 'nomina'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function descargarPDF() {
    if (!data || data.filas.length === 0) return
    const doc = new jsPDF('landscape')
    const margin = 10
    const cols = [
      { header: 'N°', dataKey: 'n' },
      { header: 'Apellido y Nombre', dataKey: 'nombre' },
      { header: 'C.I.', dataKey: 'ci' },
      { header: 'N° IPS', dataKey: 'ips' },
      { header: 'Cargo', dataKey: 'cargo' },
      { header: 'F. Ingreso', dataKey: 'fIngreso' },
      { header: 'Días', dataKey: 'dias' },
      { header: 'Salario', dataKey: 'salario' },
      { header: 'Remunerativo', dataKey: 'rem' },
      { header: 'HE', dataKey: 'he' },
      { header: 'Vac.', dataKey: 'vac' },
      { header: 'Aguinaldo', dataKey: 'agu' },
      { header: 'IPS', dataKey: 'ipsMonto' },
      { header: 'Otras Ded.', dataKey: 'otras' },
      { header: 'Neto', dataKey: 'neto' },
    ]

    const body = data.filas.map((f, i) => ({
      n: String(i + 1),
      nombre: f.nombre,
      ci: f.ci,
      ips: f.numero_ips,
      cargo: f.cargo,
      fIngreso: f.fecha_ingreso,
      dias: String(f.dias),
      salario: fmtMonto(f.salario),
      rem: fmtMonto(f.remunerativo),
      he: fmtMonto(f.he),
      vac: fmtMonto(f.vacaciones),
      agu: fmtMonto(f.aguinaldo),
      ipsMonto: fmtMonto(f.ips),
      otras: fmtMonto(f.otras_deducciones),
      neto: fmtMonto(f.neto),
    }))

    const totales = {
      dias: data.filas.reduce((s, f) => s + f.dias, 0),
      salario: data.filas.reduce((s, f) => s + f.salario, 0),
      rem: data.filas.reduce((s, f) => s + f.remunerativo, 0),
      he: data.filas.reduce((s, f) => s + f.he, 0),
      vac: data.filas.reduce((s, f) => s + f.vacaciones, 0),
      agu: data.filas.reduce((s, f) => s + f.aguinaldo, 0),
      ips: data.filas.reduce((s, f) => s + f.ips, 0),
      otras: data.filas.reduce((s, f) => s + f.otras_deducciones, 0),
      neto: data.filas.reduce((s, f) => s + f.neto, 0),
    }

    const footRow = {
      n: '',
      nombre: 'TOTALES',
      ci: '',
      ips: '',
      cargo: '',
      fIngreso: '',
      dias: String(totales.dias),
      salario: fmtMonto(totales.salario),
      rem: fmtMonto(totales.rem),
      he: fmtMonto(totales.he),
      vac: fmtMonto(totales.vac),
      agu: fmtMonto(totales.agu),
      ipsMonto: fmtMonto(totales.ips),
      otras: fmtMonto(totales.otras),
      neto: fmtMonto(totales.neto),
    }

    doc.setFontSize(14)
    doc.text('Libro de Información Laboral', margin, 20)
    doc.setFontSize(10)
    doc.text(`Período: ${data.periodo?.nombre || ''}`, margin, 28)

    doc.autoTable({
      startY: 34,
      columns: cols,
      body: [...body, footRow],
      theme: 'grid',
      headStyles: { fontSize: 7, fontStyle: 'bold', fillColor: [60, 60, 60] },
      bodyStyles: { fontSize: 6 },
      footStyles: { fontSize: 6, fontStyle: 'bold' },
      margin: { left: margin, right: margin },
      styles: { overflow: 'linebreak' },
    })

    doc.save(`libro-sueldos-${data.periodo?.nombre || 'nomina'}.pdf`)
  }

  function exportarIPS() {
    if (!data || data.filas.length === 0) return
    if (!data.numeroPatronal) {
      alertError('Error', 'Configurá el N° Patronal IPS en ⚙️ Configuración de nómina')
      return
    }
    const mes = data.periodo.fecha_desde?.slice(5, 7) || '01'
    const anyo = data.periodo.fecha_desde?.slice(0, 4) || '2026'
    const lines = data.filas.map((f) => {
      const cols = [
        data.numeroPatronal,
        f.ci,
        (f.apellido || '').toUpperCase(),
        (f.nombre_solo || '').toUpperCase(),
        'S',
        String(f.dias),
        String(Math.round(f.base_ips)),
        String(Math.round(f.salario)),
        mes,
        anyo,
      ]
      return cols.join('\t')
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ips-${data.periodo?.nombre || 'nomina'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const puedeVer = can(PERMISSIONS.NOMINA_VER)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📋 Libro de Información Laboral</h1>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 250 }}>
            <div className="meta">Período</div>
            <select className="form-input" value={periodoId} onChange={(e) => setPeriodoId(e.target.value)} style={{ width: '100%' }}>
              <option value="">— Seleccionar —</option>
              {periodos.filter((p) => p.estado !== 'abierto').map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>
              ))}
            </select>
          </div>
          <Button size="sm" onClick={handleLoad} disabled={!periodoId || loading}>{loading ? '...' : '🔍 Cargar'}</Button>
          {loaded && data?.filas?.length > 0 && (
            <>
              <Button size="sm" onClick={descargarPDF}>📥 PDF</Button>
              <Button size="sm" onClick={descargarCSV}>📥 CSV</Button>
              <Button size="sm" onClick={exportarIPS}>📤 IPS</Button>
            </>
          )}
        </div>
      </div>

      {loading && <Skeleton.Card />}

      {loaded && !loading && data?.filas?.length === 0 && (
        <div className="card"><p className="meta" style={{ padding: 24, textAlign: 'center' }}>Sin datos para este período.</p></div>
      )}

      {loaded && data?.filas?.length > 0 && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="table-wrapper" style={{ minWidth: 1200 }}>
            <table className="table" style={{ fontSize: '0.72rem' }}>
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Apellido y Nombre</th>
                  <th>C.I.</th>
                  <th>N° IPS</th>
                  <th>Cargo</th>
                  <th>F. Ingreso</th>
                  <th style={{ textAlign: 'right' }}>Días</th>
                  <th style={{ textAlign: 'right' }}>Salario</th>
                  <th style={{ textAlign: 'right' }}>Remunerativo</th>
                  <th style={{ textAlign: 'right' }}>HE</th>
                  <th style={{ textAlign: 'right' }}>Vac.</th>
                  <th style={{ textAlign: 'right' }}>Aguinaldo</th>
                  <th style={{ textAlign: 'right' }}>IPS</th>
                  <th style={{ textAlign: 'right' }}>Otras Ded.</th>
                  <th style={{ textAlign: 'right' }}>Neto</th>
                </tr>
              </thead>
              <tbody>
                {data.filas.map((f, i) => (
                  <tr key={f.empleado_id}>
                    <td className="meta">{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{f.nombre}</td>
                    <td className="meta">{f.ci}</td>
                    <td className="meta">{f.numero_ips}</td>
                    <td className="meta">{f.cargo}</td>
                    <td className="meta">{f.fecha_ingreso}</td>
                    <td style={{ textAlign: 'right' }}>{f.dias}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMonto(f.salario)}</td>
                    <td style={{ textAlign: 'right', color: '#16a34a' }}>{fmtMonto(f.remunerativo)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMonto(f.he)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMonto(f.vacaciones)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMonto(f.aguinaldo)}</td>
                    <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmtMonto(f.ips)}</td>
                    <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmtMonto(f.otras_deducciones)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMonto(f.neto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
                  <td colSpan={6} style={{ textAlign: 'right' }}>TOTALES</td>
                  <td style={{ textAlign: 'right' }}>{data.filas.reduce((s, f) => s + f.dias, 0)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMonto(data.filas.reduce((s, f) => s + f.salario, 0))}</td>
                  <td style={{ textAlign: 'right', color: '#16a34a' }}>{fmtMonto(data.filas.reduce((s, f) => s + f.remunerativo, 0))}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMonto(data.filas.reduce((s, f) => s + f.he, 0))}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMonto(data.filas.reduce((s, f) => s + f.vacaciones, 0))}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMonto(data.filas.reduce((s, f) => s + f.aguinaldo, 0))}</td>
                  <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmtMonto(data.filas.reduce((s, f) => s + f.ips, 0))}</td>
                  <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmtMonto(data.filas.reduce((s, f) => s + f.otras_deducciones, 0))}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMonto(data.filas.reduce((s, f) => s + f.neto, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
