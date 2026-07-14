import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth, Skeleton, Button, getSupabase } from '@saas/core'
import { obtenerLineasEmpleado, fmtMonto } from '../data/periodos'
import jsPDF from 'jspdf'
import { applyPlugin } from 'jspdf-autotable'
applyPlugin(jsPDF)

export function ReciboPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeCompanyId } = useAuth()
  const [detalle, setDetalle] = useState(null)
  const [lineas, setLineas] = useState([])
  const [periodo, setPeriodo] = useState(null)
  const [bancario, setBancario] = useState(null)
  const [departamento, setDepartamento] = useState(null)
  const [ciDoc, setCiDoc] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase()
        const { data } = await supabase
          .from('nomina_detalle')
          .select('*, empleado:empleado_id(nombre, apellido)')
          .eq('id', id)
          .single()
        if (data) {
          setDetalle(data)

          const [lin, per, banc, deps, ci] = await Promise.all([
            obtenerLineasEmpleado(data.id),
            supabase.from('nomina_periodos').select('nombre, fecha_desde, fecha_hasta').eq('id', data.periodo_id).single().then(r => r.data),
            supabase.from('empleado_bancario').select('banco, numero_cuenta, tipo_cuenta').eq('empleado_id', data.empleado_id).eq('company_id', activeCompanyId).maybeSingle().then(r => r.data),
            supabase.from('empleado_contratos').select('departamento:departamento_id(nombre)').eq('empleado_id', data.empleado_id).eq('activo', true).eq('company_id', activeCompanyId).maybeSingle().then(r => r.data?.departamento),
            supabase.from('empleado_documentos').select('numero').eq('empleado_id', data.empleado_id).eq('tipo', 'CI').eq('company_id', activeCompanyId).maybeSingle().then(r => r.data?.numero || ''),
          ])
          setLineas(lin || [])
          setPeriodo(per)
          setBancario(banc)
          setDepartamento(deps)
          setCiDoc(ci || '')
        }
      } catch (_) {}
      setLoading(false)
    })()
  }, [id])

  const fmt = (n) => fmtMonto(n)
  const deducible = lineas.filter((l) => (l.concepto?.tipo === 'remunerativo' || l.concepto?.tipo === 'no_remunerativo') && l.concepto?.es_imponible_irp === true)
  const remNoIrp = lineas.filter((l) => l.concepto?.tipo === 'remunerativo' && l.concepto?.es_imponible_irp !== true)
  const bases = lineas.filter((l) => l.concepto?.tipo === 'no_remunerativo')
  const descuentos = lineas.filter((l) => l.concepto?.tipo === 'deduccion')
  const aporte = lineas.filter((l) => l.concepto?.tipo === 'aporte_patronal')
  const todosHaberes = [...deducible, ...remNoIrp]
  const totalHaberes = todosHaberes.reduce((s, l) => s + Number(l.monto_total), 0)

  function descargarPDF() {
    try {
      const doc = new jsPDF()
      let y = 20
      const colW = [12, 62, 24, 42, 42]
      const margin = 14
      const tableW = 182
      const rightEdge = margin + tableW

      // Título
      doc.setFontSize(14)
      doc.text('LIQUIDACIÓN DE SUELDOS Y JORNALES', margin, y, { align: 'left' })
      y += 10

      // Header info
      doc.setFontSize(8)
      const empName = `${detalle.empleado?.apellido || ''}, ${detalle.empleado?.nombre || ''}`
      const periodoNombre = periodo?.nombre || periodo?.fecha_desde || detalle.periodo_id?.slice(0, 10) || '—'
      const lines = [
        ['Dependencia:', departamento?.nombre || '—', 'C.I.:', ciDoc],
        ['Nombre:', empName, 'Banco:', bancario?.banco || '—'],
        ['Fecha:', periodoNombre, 'Cuenta Corriente:', bancario?.numero_cuenta || '—'],
        ['Salario:', fmt(detalle.salario_base), '', ''],
      ]
      for (const row of lines) {
        doc.text(row[0], margin, y)
        doc.text(row[1], margin + 22, y)
        doc.text(row[2], margin + 90, y)
        doc.text(row[3], margin + 112, y)
        y += 5
      }

      y += 3

      // Tabla de conceptos
      const rows = []
      const todos = [...todosHaberes, ...descuentos]
      for (const l of todos) {
        rows.push([
          l.concepto?.codigo || '',
          l.concepto?.nombre || '',
          l.cantidad ? String(Number(l.cantidad).toFixed(2)) : '',
          l.concepto?.tipo !== 'deduccion' ? fmt(l.monto_total) : '',
          l.concepto?.tipo === 'deduccion' ? fmt(l.monto_total) : '',
        ])
      }

      doc.autoTable({
        startY: y,
        head: [['COD.', 'CONCEPTO', 'REFERENCIA', 'HABERES', 'DESCUENTOS']],
        body: rows,
        foot: [[
          { content: 'TOTALES', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: fmt(totalHaberes), styles: { fontStyle: 'bold', halign: 'right' } },
          { content: fmt(detalle.total_deducciones), styles: { fontStyle: 'bold', halign: 'right' } },
        ]],
        theme: 'grid',
        headStyles: { fontSize: 7, fontStyle: 'bold', halign: 'center', fillColor: [60, 60, 60] },
        bodyStyles: { fontSize: 7 },
        footStyles: { fontSize: 7, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: colW[0], halign: 'left' },
          1: { cellWidth: colW[1], halign: 'left' },
          2: { cellWidth: colW[2], halign: 'right' },
          3: { cellWidth: colW[3], halign: 'right' },
          4: { cellWidth: colW[4], halign: 'right' },
        },
        margin: { left: margin, right: margin },
        tableWidth: tableW,
      })

      y = doc.lastAutoTable.finalY + 6

      // Neto
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('NETO A COBRAR', margin, y)
      doc.text(fmt(detalle.neto_pagar), rightEdge, y, { align: 'right' })
      y += 8

      // Bases imponibles
      if (bases.length > 0) {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text('Bases imponibles', margin, y)
        y += 4
        doc.setFont('helvetica', 'normal')
        for (const l of bases) {
          doc.text(`${l.concepto?.codigo} — ${l.concepto?.nombre}`, margin, y)
          doc.text(fmt(l.monto_total), rightEdge, y, { align: 'right' })
          y += 4
        }
      }

      // Aportes patronales
      if (aporte.length > 0) {
        y += 2
        doc.setFont('helvetica', 'bold')
        doc.text('Aportes patronales', margin, y)
        y += 4
        doc.setFont('helvetica', 'normal')
        for (const l of aporte) {
          doc.text(`${l.concepto?.codigo} — ${l.concepto?.nombre}`, margin, y)
          doc.text(fmt(l.monto_total), rightEdge, y, { align: 'right' })
          y += 4
        }
      }

      // Recibí
      y = Math.max(y + 10, doc.internal.pageSize.height - 30)
      doc.setFontSize(8)
      doc.text('RECIBÍ: El importe de esta liquidación y copia de este recibo', doc.internal.pageSize.width / 2, y, { align: 'center' })

      doc.save(`recibo-${detalle.empleado?.apellido || 'empleado'}-${periodo?.nombre || 'nomina'}.pdf`)
    } catch (err) {
      console.error('Error al generar PDF:', err)
    }
  }

  if (loading) return <Skeleton.Card />
  if (!detalle) return <div className="card"><p className="meta" style={{ padding: 24, textAlign: 'center' }}>Sin datos</p></div>

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>← Volver</button>
        <Button size="sm" onClick={descargarPDF}>📥 PDF</Button>
        <Button size="sm" onClick={() => window.print()} style={{ marginLeft: 4 }}>🖨 Imprimir</Button>
      </div>
      <div className="card" id="recibo" style={{ maxWidth: 800, margin: '0 auto', fontSize: '0.82rem' }}>
        <style>{`
          @media print {
            body { margin: 0; padding: 0; }
            #recibo { max-width: 100% !important; box-shadow: none !important; padding: 12px !important; }
            #recibo table { table-layout: fixed; width: 100%; overflow-wrap: break-word; }
            .card { border: none !important; }
          }
        `}</style>
        {/* Título */}
        <div style={{ textAlign: 'center', marginBottom: 16, borderBottom: '2px solid #000', paddingBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: '0.95rem', textTransform: 'uppercase' }}>Liquidación de Sueldos y Jornales</h2>
        </div>

        {/* Header info */}
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: 12 }}>
          <tbody>
            <tr>
              <td style={{ padding: '1px 4px', width: '15%' }}><strong>Dependencia:</strong></td>
              <td style={{ padding: '1px 4px', width: '35%' }}>{departamento?.nombre || '—'}</td>
              <td style={{ padding: '1px 4px', width: '15%' }}><strong>C.I.:</strong></td>
              <td style={{ padding: '1px 4px', width: '35%' }}>{ciDoc || ''}</td>
            </tr>
            <tr>
              <td style={{ padding: '1px 4px' }}><strong>Nombre:</strong></td>
              <td style={{ padding: '1px 4px' }}>{detalle.empleado?.apellido}, {detalle.empleado?.nombre}</td>
              <td style={{ padding: '1px 4px' }}><strong>Banco:</strong></td>
              <td style={{ padding: '1px 4px' }}>{bancario?.banco || '—'}</td>
            </tr>
            <tr>
              <td style={{ padding: '1px 4px' }}><strong>Fecha:</strong></td>
              <td style={{ padding: '1px 4px' }}>{periodo?.nombre || periodo?.fecha_desde || detalle.periodo_id?.slice(0, 10) || '—'}</td>
              <td style={{ padding: '1px 4px' }}><strong>Cuenta Corriente:</strong></td>
              <td style={{ padding: '1px 4px' }}>{bancario?.numero_cuenta || '—'}</td>
            </tr>
            <tr>
              <td style={{ padding: '1px 4px' }}><strong>Salario:</strong></td>
              <td style={{ padding: '1px 4px' }}>{fmt(detalle.salario_base)}</td>
              <td style={{ padding: '1px 4px' }}></td>
              <td style={{ padding: '1px 4px' }}></td>
            </tr>
          </tbody>
        </table>

        {/* Tabla principal */}
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.75rem', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
          <thead>
            <tr style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
              <th style={{ padding: '3px 4px', textAlign: 'left', width: '20%' }}>COD.</th>
              <th style={{ padding: '3px 4px', textAlign: 'left', width: '30%' }}>CONCEPTO</th>
              <th style={{ padding: '3px 4px', textAlign: 'right', width: '12%' }}>REFERENCIA</th>
              <th style={{ padding: '3px 4px', textAlign: 'right', width: '19%' }}>HABERES</th>
              <th style={{ padding: '3px 4px', textAlign: 'right', width: '19%' }}>DESCUENTOS</th>
            </tr>
          </thead>
          <tbody>
            {[...todosHaberes, ...descuentos].map((l) => (
              <tr key={l.id}>
                <td style={{ padding: '1px 4px', textAlign: 'left', verticalAlign: 'top' }}>{l.concepto?.codigo}</td>
                <td style={{ padding: '1px 4px', textAlign: 'left', verticalAlign: 'top' }}>{l.concepto?.nombre}</td>
                <td style={{ padding: '1px 4px', textAlign: 'right', verticalAlign: 'top' }}>{l.cantidad ? `${Number(l.cantidad).toFixed(2)}` : ''}</td>
                <td style={{ padding: '1px 4px', textAlign: 'right', verticalAlign: 'top' }}>{l.concepto?.tipo !== 'deduccion' ? fmt(l.monto_total) : ''}</td>
                <td style={{ padding: '1px 4px', textAlign: 'right', verticalAlign: 'top' }}>{l.concepto?.tipo === 'deduccion' ? fmt(l.monto_total) : ''}</td>
              </tr>
            ))}

            {/* Totales */}
            <tr style={{ borderTop: '1px solid #000', fontWeight: 700 }}>
              <td colSpan={3} style={{ padding: '3px 4px', textAlign: 'right' }}>TOTALES</td>
              <td style={{ padding: '3px 4px', textAlign: 'right' }}>{fmt(totalHaberes)}</td>
              <td style={{ padding: '3px 4px', textAlign: 'right' }}>{fmt(detalle.total_deducciones)}</td>
            </tr>
          </tbody>
        </table>

        {/* Neto */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 800, marginTop: 8, borderTop: '2px solid #000', paddingTop: 6 }}>
          <span>NETO A COBRAR</span><span>{fmt(detalle.neto_pagar)}</span>
        </div>

        {/* Bases imponibles */}
        {bases.length > 0 && (
          <div style={{ marginTop: 12, borderTop: '1px solid #ccc', paddingTop: 6 }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 2 }}>Bases imponibles</div>
            {bases.map((l) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '1px 0' }}>
                <span>{l.concepto?.codigo} — {l.concepto?.nombre}</span>
                <span>{fmt(l.monto_total)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Aportes patronales */}
        {aporte.length > 0 && (
          <div style={{ marginTop: 12, borderTop: '1px solid #ccc', paddingTop: 6 }}>
            <div style={{ fontWeight: 700, fontSize: '0.72rem', marginBottom: 2 }}>Aportes patronales</div>
            {aporte.map((l) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '1px 0' }}>
                <span>{l.concepto?.codigo} — {l.concepto?.nombre}</span>
                <span>{fmt(l.monto_total)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recibí */}
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: '0.72rem' }}>
          <p style={{ borderTop: '1px solid #000', paddingTop: 4, display: 'inline-block', margin: 0 }}>
            RECIBÍ: El importe de esta liquidación y copia de este recibo
          </p>
        </div>
      </div>
    </div>
  )
}
