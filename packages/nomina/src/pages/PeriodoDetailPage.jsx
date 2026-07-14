import { Fragment, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, alertError, notify, getSupabase, PERMISSIONS } from '@saas/core'
import { obtenerDetallePeriodo, obtenerLineasEmpleado, fmtMonto } from '../data/periodos'
import { listarNovedadesEmpleado, guardarNovedad, eliminarNovedad } from '../data/novedades'
import { listarConceptos } from '../data/conceptos'
import jsPDF from 'jspdf'
import { applyPlugin } from 'jspdf-autotable'
applyPlugin(jsPDF)

export function PeriodoDetailPage() {
  const { id } = useParams()
  const { activeCompanyId, can } = useAuth()
  const puedeEditar = can(PERMISSIONS.NOMINA_CREAR)
  const [detalle, setDetalle] = useState([])
  const [loading, setLoading] = useState(true)
  const [periodoInfo, setPeriodoInfo] = useState(null)
  const [expandido, setExpandido] = useState(null)
  const [lineas, setLineas] = useState([])
  const [novedades, setNovedades] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [novEmp, setNovEmp] = useState(null)
  const [conceptos, setConceptos] = useState([])
  const [novForm, setNovForm] = useState({ concepto_id: '', monto: '', descripcion: '' })
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    const supabase = getSupabase()
    const [d, per] = await Promise.all([
      obtenerDetallePeriodo(id).catch(() => []),
      supabase.from('nomina_periodos').select('nombre, tipo').eq('id', id).maybeSingle().then((r) => r.data),
    ])
    setDetalle(d)
    setPeriodoInfo(per)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function verLineas(nominaDetalleId) {
    if (expandido === nominaDetalleId) { setExpandido(null); return }
    setExpandido(nominaDetalleId)
    const emp = detalle.find((d) => d.id === nominaDetalleId)
    try {
      const lin = await obtenerLineasEmpleado(nominaDetalleId)
      const nov = await listarNovedadesEmpleado(id, emp?.empleado_id).catch(() => [])
      setLineas(lin || [])
      setNovedades(nov || [])
    } catch (err) {
      console.error('[DEBUG] Error:', err)
    }
  }

  async function abrirModal(d) {
    setNovEmp(d)
    setNovForm({ concepto_id: '', monto: '', descripcion: '' })
    setConceptos(await listarConceptos(activeCompanyId).catch(() => []))
    setShowModal(true)
  }

  async function handleGuardarNovedad() {
    const concSel = conceptos.find((c) => c.id === novForm.concepto_id)
    const tieneFormula = concSel?.formula && concSel.formula !== ''
    if (!novForm.concepto_id || (!novForm.monto && !tieneFormula)) { alertError('Error', 'Concepto y monto requeridos'); return }
    setSubmitting(true)
    try {
      await guardarNovedad(activeCompanyId, {
        empleado_id: novEmp.empleado_id,
        concepto_id: novForm.concepto_id,
        periodo_id: id,
        monto: novForm.monto,
        descripcion: novForm.descripcion,
      })
      notify('Novedad agregada')
      setShowModal(false)
      await load()
      if (expandido) verLineas(expandido)
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  async function handleEliminarNovedad(novedadId) {
    if (!window.confirm('¿Eliminar esta novedad?')) return
    try {
      await eliminarNovedad(novedadId)
      notify('Novedad eliminada')
      await load()
      if (expandido) verLineas(expandido)
    } catch (err) { alertError('Error', err.message) }
  }

  const totalRem = detalle.reduce((s, r) => s + Number(r.total_remunerativo), 0)
  const totalDed = detalle.reduce((s, r) => s + Number(r.total_deducciones), 0)
  const totalNeto = detalle.reduce((s, r) => s + Number(r.neto_pagar), 0)

  async function exportarRecibosMasivos() {
    if (detalle.length === 0) return
    const supabase = getSupabase()
    const doc = new jsPDF()
    const margin = 14
    const tableW = 182
    const rightEdge = margin + tableW

    for (let i = 0; i < detalle.length; i++) {
      const d = detalle[i]
      const lines = await obtenerLineasEmpleado(d.id).catch(() => [])
      const linesList = lines || []

      // Datos adicionales
      const [{ data: periodo }, { data: bancario }, { data: contrato }, { data: ciDoc }] = await Promise.all([
        supabase.from('nomina_periodos').select('nombre, fecha_desde, fecha_hasta').eq('id', id).maybeSingle(),
        supabase.from('empleado_bancario').select('banco, numero_cuenta').eq('empleado_id', d.empleado_id).eq('company_id', activeCompanyId).maybeSingle(),
        supabase.from('empleado_contratos').select('departamento:departamento_id(nombre)').eq('empleado_id', d.empleado_id).eq('activo', true).eq('company_id', activeCompanyId).maybeSingle(),
        supabase.from('empleado_documentos').select('numero').eq('empleado_id', d.empleado_id).eq('tipo', 'CI').eq('company_id', activeCompanyId).maybeSingle(),
      ])

      if (i > 0) doc.addPage()
      let y = 20

      // Título
      doc.setFontSize(14)
      doc.text('LIQUIDACIÓN DE SUELDOS Y JORNALES', margin, y)
      y += 10

      // Header info
      doc.setFontSize(8)
      const empName = `${d.empleado?.apellido || ''}, ${d.empleado?.nombre || ''}`
      const periodoNombre = periodo?.nombre || periodo?.fecha_desde || ''
      const infoRows = [
        ['Dependencia:', contrato?.departamento?.nombre || '—', 'C.I.:', ciDoc?.numero || ''],
        ['Nombre:', empName, 'Banco:', bancario?.banco || '—'],
        ['Fecha:', periodoNombre, 'Cuenta Corriente:', bancario?.numero_cuenta || '—'],
        ['Salario:', fmtMonto(d.salario_base), '', ''],
      ]
      for (const row of infoRows) {
        doc.text(row[0], margin, y)
        doc.text(row[1], margin + 22, y)
        doc.text(row[2], margin + 90, y)
        doc.text(row[3], margin + 112, y)
        y += 5
      }
      y += 3

      // Tabla
      const deducible = linesList.filter((l) => (l.concepto?.tipo === 'remunerativo' || l.concepto?.tipo === 'no_remunerativo') && l.concepto?.es_imponible_irp === true)
      const descuentos = linesList.filter((l) => l.concepto?.tipo === 'deduccion')
      const noDeducible = linesList.filter((l) => l.concepto?.tipo === 'no_remunerativo')
      const aporte = linesList.filter((l) => l.concepto?.tipo === 'aporte_patronal')
      const todosHaberes = [...deducible, ...linesList.filter((l) => l.concepto?.tipo === 'remunerativo' && l.concepto?.es_imponible_irp !== true)]
      const totalHaberes = todosHaberes.reduce((s, l) => s + Number(l.monto_total), 0)

      const tablaRows = []
      for (const l of [...todosHaberes, ...descuentos]) {
        tablaRows.push([
          l.concepto?.codigo || '',
          l.concepto?.nombre || '',
          l.cantidad ? String(Number(l.cantidad).toFixed(2)) : '',
          l.concepto?.tipo !== 'deduccion' ? fmtMonto(l.monto_total) : '',
          l.concepto?.tipo === 'deduccion' ? fmtMonto(l.monto_total) : '',
        ])
      }

      doc.autoTable({
        startY: y,
        head: [['COD.', 'CONCEPTO', 'REFERENCIA', 'HABERES', 'DESCUENTOS']],
        body: tablaRows,
        foot: [[
          { content: 'TOTALES', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: fmtMonto(totalHaberes), styles: { fontStyle: 'bold', halign: 'right' } },
          { content: fmtMonto(d.total_deducciones), styles: { fontStyle: 'bold', halign: 'right' } },
        ]],
        theme: 'grid',
        headStyles: { fontSize: 7, fontStyle: 'bold', halign: 'center', fillColor: [60, 60, 60] },
        bodyStyles: { fontSize: 7 },
        footStyles: { fontSize: 7, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 12, halign: 'left' },
          1: { cellWidth: 62, halign: 'left' },
          2: { cellWidth: 24, halign: 'right' },
          3: { cellWidth: 42, halign: 'right' },
          4: { cellWidth: 42, halign: 'right' },
        },
        margin: { left: margin, right: margin },
        tableWidth: tableW,
      })

      y = doc.lastAutoTable.finalY + 6

      // Neto
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('NETO A COBRAR', margin, y)
      doc.text(fmtMonto(d.neto_pagar), rightEdge, y, { align: 'right' })
      y += 8

      // Bases
      if (noDeducible.length > 0) {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text('Bases imponibles', margin, y)
        y += 4
        doc.setFont('helvetica', 'normal')
        for (const l of noDeducible) {
          doc.text(`${l.concepto?.codigo} — ${l.concepto?.nombre}`, margin, y)
          doc.text(fmtMonto(l.monto_total), rightEdge, y, { align: 'right' })
          y += 4
        }
      }

      // Aportes
      if (aporte.length > 0) {
        y += 2
        doc.setFont('helvetica', 'bold')
        doc.text('Aportes patronales', margin, y)
        y += 4
        doc.setFont('helvetica', 'normal')
        for (const l of aporte) {
          doc.text(`${l.concepto?.codigo} — ${l.concepto?.nombre}`, margin, y)
          doc.text(fmtMonto(l.monto_total), rightEdge, y, { align: 'right' })
          y += 4
        }
      }

      // Recibí
      y = Math.max(y + 10, doc.internal.pageSize.height - 30)
      doc.setFontSize(8)
      doc.text('RECIBÍ: El importe de esta liquidación y copia de este recibo', doc.internal.pageSize.width / 2, y, { align: 'center' })
    }

    doc.save(`recibos-${id?.slice(0, 8)}.pdf`)
  }

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📋 {periodoInfo?.nombre || 'Detalle de nómina'}</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to={`/nomina/novedades/${id}`}><Button size="sm" variant="ghost">➕ Novedades</Button></Link>
            {detalle.length > 0 && <Button size="sm" onClick={exportarRecibosMasivos}>📥 Exportar recibos</Button>}
            <Link to="/nomina/periodos" onClick={() => sessionStorage.setItem('nomina_periodo_id', id)}><Button variant="ghost" size="sm">← Volver</Button></Link>
          </div>
        </div>
      </div>

      {detalle.length === 0 ? <div className="card"><p className="meta" style={{ padding: 24, textAlign: 'center' }}>Sin empleados en este período. Calculá la nómina primero.</p></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr><th>Empleado</th><th style={{ textAlign: 'right' }}>Días</th><th style={{ textAlign: 'right' }}>Salario</th><th style={{ textAlign: 'right', color: '#16a34a' }}>Remunerativo</th><th style={{ textAlign: 'right', color: '#dc2626' }}>Deducciones</th><th style={{ textAlign: 'right', fontWeight: 700 }}>Neto</th><th></th></tr>
              </thead>
              <tbody>
                {detalle.map((d) => (
                  <Fragment key={d.id}>
                    <tr key={d.id}>
                      <td data-label="Empleado" style={{ fontWeight: 600 }}>{d.empleado?.apellido}, {d.empleado?.nombre}</td>
                      <td data-label="Días" style={{ textAlign: 'right' }}>{d.dias_trabajados}</td>
                      <td data-label="Salario" style={{ textAlign: 'right' }}>{fmtMonto(d.salario_base)}</td>
                      <td data-label="Remunerativo" style={{ textAlign: 'right', color: '#16a34a' }}>{fmtMonto(d.total_remunerativo)}</td>
                      <td data-label="Deducciones" style={{ textAlign: 'right', color: '#dc2626' }}>{fmtMonto(d.total_deducciones)}</td>
                      <td data-label="Neto" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMonto(d.neto_pagar)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => verLineas(d.id)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.82rem' }}>
                            {expandido === d.id ? '▲' : '▼'}
                          </button>
                          {puedeEditar && (
                            <button onClick={() => abrirModal(d)} style={{ background: 'none', border: 'none', color: '#d97706', cursor: 'pointer', fontSize: '0.82rem' }} title="Agregar novedad">➕</button>
                          )}
                          <Link to={`/nomina/recibos/${d.id}`} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: '0.82rem', textDecoration: 'none' }}>🧾</Link>
                        </div>
                      </td>
                    </tr>
                    {expandido === d.id && (
                      <tr key={`lin-${d.id}`}>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div style={{ padding: 12, background: '#f9fafb' }}>
                            {lineas.length === 0 && novedades.length === 0 ? <p className="meta">Cargando...</p> : (
                              <>
                                <table className="table" style={{ fontSize: '0.78rem' }}>
                                  <thead><tr><th>Concepto</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Cantidad</th><th style={{ textAlign: 'right' }}>Unitario</th><th style={{ textAlign: 'right' }}>Total</th><th>Origen</th><th></th></tr></thead>
                                  <tbody>
                                    {lineas.map((l) => (
                                      <tr key={l.id}>
                                        <td>{l.concepto?.codigo} — {l.concepto?.nombre}</td>
                                        <td><span className="badge" style={{
                                          background: l.concepto?.tipo === 'remunerativo' ? '#dcfce7' : l.concepto?.tipo === 'deduccion' ? '#fef2f2' : l.concepto?.tipo === 'base' ? '#ede9fe' : '#f3f4f6',
                                          color: l.concepto?.tipo === 'remunerativo' ? '#16a34a' : l.concepto?.tipo === 'deduccion' ? '#dc2626' : l.concepto?.tipo === 'base' ? '#7c3aed' : '#6b7280',
                                        }}>{l.concepto?.tipo}</span></td>
                                        <td data-label="Cantidad" style={{ textAlign: 'right' }}>{l.cantidad ?? '—'}</td>
                                        <td data-label="Unitario" style={{ textAlign: 'right' }}>{l.monto_unitario ? fmtMonto(l.monto_unitario) : '—'}</td>
                                        <td data-label="Total" style={{ textAlign: 'right', fontWeight: 600 }}>{fmtMonto(l.monto_total)}</td>
                                        <td style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{l.origen === 'manual' ? '📝 Manual' : l.origen === 'control_horario' ? '⏱ HE' : '—'}</td>
                                        <td></td>
                                      </tr>
                                    ))}
                                    {novedades.map((n) => (
                                      <tr key={n.id} style={{ background: '#fefce8' }}>
                                        <td>➕ {n.concepto?.codigo} — {n.concepto?.nombre}</td>
                                        <td><span className="badge" style={{
                                          background: n.concepto?.tipo === 'remunerativo' ? '#dcfce7' : n.concepto?.tipo === 'deduccion' ? '#fef2f2' : '#f3f4f6',
                                          color: n.concepto?.tipo === 'remunerativo' ? '#16a34a' : n.concepto?.tipo === 'deduccion' ? '#dc2626' : '#6b7280',
                                        }}>{n.concepto?.tipo}</span></td>
                                        <td data-label="Cantidad" style={{ textAlign: 'right' }}>1</td>
                                        <td data-label="Unitario" style={{ textAlign: 'right' }}>{fmtMonto(n.monto)}</td>
                                        <td data-label="Total" style={{ textAlign: 'right', fontWeight: 600 }}>{fmtMonto(n.monto)}</td>
                                        <td style={{ fontSize: '0.72rem', color: '#d97706' }}>📝 Novedad</td>
                                        <td>{puedeEditar && <button onClick={() => handleEliminarNovedad(n.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.78rem' }}>✕</button>}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                </>                              
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
                  <td data-label="">Total ({detalle.length} empleados)</td>
                  <td data-label="" style={{ textAlign: 'right' }}></td>
                  <td data-label="" style={{ textAlign: 'right' }}></td>
                  <td data-label="Remunerativo" style={{ textAlign: 'right', color: '#16a34a' }}>{fmtMonto(totalRem)}</td>
                  <td data-label="Deducciones" style={{ textAlign: 'right', color: '#dc2626' }}>{fmtMonto(totalDed)}</td>
                  <td data-label="Neto" style={{ textAlign: 'right' }}>{fmtMonto(totalNeto)}</td>
                  <td data-label=""></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Modal agregar novedad */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 380, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>➕ Novedad para {novEmp?.empleado?.apellido}, {novEmp?.empleado?.nombre}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><div className="meta">Concepto</div>
                <select className="form-input" value={novForm.concepto_id} onChange={(e) => setNovForm((p) => ({ ...p, concepto_id: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">— Seleccionar —</option>
                  {conceptos.filter((c) => c.tipo !== 'base' && c.tipo !== 'aporte_patronal').map((c) => (
                    <option key={c.id} value={c.id}>{c.codigo} — {c.nombre} ({c.tipo})</option>
                  ))}
                </select>
              </div>
              <div><div className="meta">Monto</div><input className="form-input" type="number" step="0.01" value={novForm.monto} onChange={(e) => setNovForm((p) => ({ ...p, monto: e.target.value }))} placeholder="Ej: 500000" style={{ width: '100%' }} /></div>
              <div><div className="meta">Descripción (opcional)</div><input className="form-input" value={novForm.descripcion} onChange={(e) => setNovForm((p) => ({ ...p, descripcion: e.target.value }))} placeholder="Ej: Bono por productividad" style={{ width: '100%' }} /></div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Button size="sm" onClick={handleGuardarNovedad} disabled={submitting}>{submitting ? '...' : '💾 Agregar'}</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancelar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
