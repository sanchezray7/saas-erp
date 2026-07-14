import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, Button, Skeleton, alertError, notify, getSupabase, PERMISSIONS, formatearFecha } from '@saas/core'
import { listarPeriodos, crearPeriodo, calcularPeriodo, aprobarPeriodo, pagarPeriodo, eliminarPeriodo, generarPeriodos, previsualizarAsientoNomina, fmtMonto } from '../data/periodos'
import { generarAsientoNomina } from '@saas/accounting'

const TIPOS = ['ordinario', 'adelanto', 'aguinaldo', 'complementario', 'extraordinario']
const TIPO_LABEL = { ordinario: 'Ordinario', adelanto: 'Adelanto', aguinaldo: 'Aguinaldo', complementario: 'Complementario', extraordinario: 'Extraordinario' }
const ESTADOS = { abierto: { bg: '#fef3c7', color: '#d97706', label: 'Abierto' }, calculado: { bg: '#dbeafe', color: '#2563eb', label: 'Calculado' }, aprobado: { bg: '#dcfce7', color: '#16a34a', label: 'Aprobado' }, pagado: { bg: '#f3f4f6', color: '#6b7280', label: 'Pagado' } }

export function PeriodosNominaPage() {
  const { activeCompanyId, user, can, pais } = useAuth()
  const navigate = useNavigate()
  const puedeCrear = can(PERMISSIONS.NOMINA_CREAR)
  const puedeAprobar = can(PERMISSIONS.NOMINA_APROBAR)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [tipo, setTipo] = useState('ordinario')
  const [selectedId, setSelectedId] = useState('')
  const [calculando, setCalculando] = useState(false)
  const [contabilizando, setContabilizando] = useState(false)
  const [kpLoading, setKpLoading] = useState(false)
  const [kp, setKp] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showGenModal, setShowGenModal] = useState(false)
  const [genHasta, setGenHasta] = useState('')
  const [generando, setGenerando] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [expandedAcct, setExpandedAcct] = useState(null)
  const [form, setForm] = useState({ nombre: '', fecha_desde: '', fecha_hasta: '', fecha_pago: '', frecuencia: 'mensual', tipo: 'ordinario' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const savedId = sessionStorage.getItem('nomina_periodo_id')
    listarPeriodos(activeCompanyId).then((p) => {
      setData(p)
      const restore = savedId && p.find((x) => x.id === savedId)
      if (restore) { setSelectedId(savedId); setTipo(restore.tipo) }
      else if (p.length > 0) setSelectedId(p[0].id)
      sessionStorage.removeItem('nomina_periodo_id')
    }).catch(() => {}).finally(() => setLoading(false))
  }, [activeCompanyId])

  const periodosFiltrados = data.filter((p) => p.tipo === tipo).sort((a, b) => b.fecha_desde?.localeCompare(a.fecha_desde))
  const periodo = data.find((p) => p.id === selectedId)

  useEffect(() => {
    if (!periodosFiltrados.length) { setSelectedId(''); setKp(null); return }
    if (!periodosFiltrados.find((p) => p.id === selectedId)) setSelectedId(periodosFiltrados[0].id)
  }, [tipo, periodosFiltrados.length])

  useEffect(() => {
    if (!selectedId) { setKp(null); return }
    setKpLoading(true)
    const supabase = getSupabase()
    supabase.from('nomina_detalle').select('empleado_id, total_remunerativo, total_deducciones, neto_pagar').eq('periodo_id', selectedId).then(({ data: d }) => {
      if (d) {
        const empSet = new Set(d.map((r) => r.empleado_id))
        setKp({ empleados: empSet.size, rem: d.reduce((s, r) => s + Number(r.total_remunerativo), 0), ded: d.reduce((s, r) => s + Number(r.total_deducciones), 0), neto: d.reduce((s, r) => s + Number(r.neto_pagar), 0) })
      } else setKp(null)
    }).catch(() => setKp(null)).finally(() => setKpLoading(false))
  }, [selectedId])

  async function handleCalcular() {
    if (!selectedId) return
    setCalculando(true)
    try {
      const total = await calcularPeriodo(selectedId)
      notify(`Nómina calculada (${total} empleados)`)
      setData(await listarPeriodos(activeCompanyId))
    } catch (err) { alertError('Error', err.message) }
    finally { setCalculando(false) }
  }

  async function handleAprobar() {
    if (!selectedId) return
    setPreviewData(null)
    try {
      const preview = await previsualizarAsientoNomina(selectedId)
      if (preview?.error) { alertError('Error', preview.error); return }
      setPreviewData(preview)
      setShowPreviewModal(true)
    } catch (err) { alertError('Error', err.message) }
  }

  async function handleContabilizar() {
    if (!selectedId) return
    setContabilizando(true)
    try {
      await aprobarPeriodo(selectedId, user?.id)
      await generarAsientoNomina(selectedId)
      notify('Nómina aprobada y contabilizada')
      setShowPreviewModal(false)
      setData(await listarPeriodos(activeCompanyId))
    } catch (err) { alertError('Error', err.message) }
    finally { setContabilizando(false) }
  }

  async function handlePagar() {
    if (!selectedId) return
    try { await pagarPeriodo(selectedId); notify('Nómina pagada'); setData(await listarPeriodos(activeCompanyId)) }
    catch (err) { alertError('Error', err.message) }
  }

  if (loading) return <Skeleton.Card />

  const est = periodo ? (ESTADOS[periodo.estado] || ESTADOS.abierto) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="card">
        <div className="page-header">
          <h1>📋 Período de nómina</h1>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 160 }}>
            <div className="meta">Tipo</div>
            <select className="form-input" value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ width: '100%' }}>
              {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 220 }}>
            <div className="meta">Período</div>
            <select className="form-input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ width: '100%' }}>
              {periodosFiltrados.length === 0 && <option value="">— Sin períodos —</option>}
              {periodosFiltrados.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.estado}) — Pago: {formatearFecha(p.fecha_pago, pais) || '—'}</option>)}
            </select>
          </div>
          {puedeCrear && <Button size="sm" onClick={() => setShowModal(true)}>+ Nuevo</Button>}
          {puedeCrear && <Button size="sm" variant="ghost" onClick={() => setShowGenModal(true)}>🔁 Generar</Button>}
        </div>
      </div>

      {!periodo ? (
        <div className="card"><p className="meta" style={{ padding: 24, textAlign: 'center' }}>Sin períodos de tipo {TIPO_LABEL[tipo]}. Creá uno nuevo.</p></div>
      ) : (
        <>
          {/* Info + acciones */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', margin: '0 0 8px' }}>{periodo.nombre}</h2>
                <div style={{ display: 'flex', gap: 16, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <span>{periodo.fecha_desde?.slice(0, 10)} → {periodo.fecha_hasta?.slice(0, 10)}</span>
                  <span>Frecuencia: {periodo.frecuencia}</span>
                  <span>Tipo: {TIPO_LABEL[periodo.tipo]}</span>
                </div>
              </div>
              <span className="badge" style={{ padding: '6px 16px', fontSize: '0.85rem', fontWeight: 600, background: est?.bg || '#f3f4f6', color: est?.color || '#6b7280' }}>{est?.label || periodo.estado}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              {periodo.estado !== 'aprobado' && periodo.estado !== 'pagado' && puedeCrear && (
                <Button size="sm" onClick={handleCalcular} disabled={calculando}>{calculando ? '...' : '🧮 Calcular'}</Button>
              )}
              {periodo.estado === 'calculado' && puedeAprobar && (
                <Button size="sm" onClick={handleAprobar}>✅ Aprobar</Button>
              )}
              {periodo.estado === 'aprobado' && puedeAprobar && (
                <Button size="sm" onClick={handlePagar}>💰 Pagar</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => navigate(`/nomina/periodos/${selectedId}`)}>📋 Detalle</Button>
              {periodo.estado === 'abierto' && puedeCrear && (
                <Button size="sm" variant="ghost" onClick={async () => { if (window.confirm('¿Eliminar período?')) { await eliminarPeriodo(selectedId); setData(await listarPeriodos(activeCompanyId)) } }}>🗑 Eliminar</Button>
              )}
            </div>
          </div>

          {/* KPIs */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-value">{kpLoading ? '...' : (kp?.empleados || 0)}</div>
              <div className="kpi-label">Empleados</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: '#16a34a' }}>{kpLoading ? '...' : fmtMonto(kp?.rem || 0)}</div>
              <div className="kpi-label">Remunerativo</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: '#dc2626' }}>{kpLoading ? '...' : fmtMonto(kp?.ded || 0)}</div>
              <div className="kpi-label">Deducciones</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: '#2563eb' }}>{kpLoading ? '...' : fmtMonto(kp?.neto || 0)}</div>
              <div className="kpi-label">Neto a Pagar</div>
            </div>
          </div>
        </>
      )}

      {/* Modal nuevo período */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 420, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>📋 Nuevo período</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><div className="meta">Nombre</div><input className="form-input" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Julio 2026" style={{ width: '100%' }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><div className="meta">Desde</div><input className="form-input" type="date" value={form.fecha_desde} onChange={(e) => setForm((p) => ({ ...p, fecha_desde: e.target.value }))} style={{ width: '100%' }} /></div>
                <div><div className="meta">Hasta</div><input className="form-input" type="date" value={form.fecha_hasta} onChange={(e) => setForm((p) => ({ ...p, fecha_hasta: e.target.value }))} style={{ width: '100%' }} /></div>
              </div>
              <div><div className="meta">Fecha de pago</div><input className="form-input" type="date" value={form.fecha_pago} onChange={(e) => setForm((p) => ({ ...p, fecha_pago: e.target.value }))} style={{ width: '100%' }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><div className="meta">Frecuencia</div>
                  <select className="form-input" value={form.frecuencia} onChange={(e) => setForm((p) => ({ ...p, frecuencia: e.target.value }))} style={{ width: '100%' }}>
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
                <div><div className="meta">Tipo</div>
                  <select className="form-input" value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))} style={{ width: '100%' }}>
                    {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button size="sm" onClick={async () => { if (!form.nombre || !form.fecha_desde || !form.fecha_hasta) { alertError('Error', 'Nombre y fechas requeridos'); return }; setSubmitting(true); try { const id = await crearPeriodo(activeCompanyId, form); notify('Período creado'); setShowModal(false); setForm({ nombre: '', fecha_desde: '', fecha_hasta: '', fecha_pago: '', frecuencia: 'mensual', tipo: 'ordinario' }); const p = await listarPeriodos(activeCompanyId); setData(p); setTipo(form.tipo); setSelectedId(id) } catch (err) { alertError('Error', err.message) }; setSubmitting(false) }} disabled={submitting}>{submitting ? '...' : '💾 Crear'}</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal generar */}
      {showGenModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowGenModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 380, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}><h3 style={{ fontSize: '0.95rem', margin: 0 }}>🔁 Generar próximos</h3><button onClick={() => setShowGenModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button></div>
            <p className="meta">Se generarán períodos desde el último existente.</p>
            <div><div className="meta">Hasta fecha</div><input className="form-input" type="date" value={genHasta} onChange={(e) => setGenHasta(e.target.value)} style={{ width: '100%' }} /></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button size="sm" onClick={async () => { if (!genHasta) { alertError('Error', 'Seleccioná fecha'); return }; setGenerando(true); try { const ids = await generarPeriodos(activeCompanyId, genHasta); notify(`${ids.length} períodos generados`); setShowGenModal(false); setGenHasta(''); setData(await listarPeriodos(activeCompanyId)) } catch (err) { alertError('Error', err.message) }; setGenerando(false) }} disabled={generando || !genHasta}>{generando ? '...' : '🔁 Generar'}</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowGenModal(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal preview asiento */}
      {showPreviewModal && previewData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowPreviewModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 600, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>📒 Previsualizar asiento contable</h3>
              <button onClick={() => setShowPreviewModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <p className="meta">Revisá las líneas antes de contabilizar.</p>
            <div className="table-wrapper" style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table className="table" style={{ fontSize: '0.78rem' }}>
                <thead><tr><th>Cuenta</th><th style={{ textAlign: 'right' }}>Debe</th><th style={{ textAlign: 'right' }}>Haber</th></tr></thead>
                <tbody>
                  {previewData.lines?.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center' }} className="meta">Sin líneas</td></tr>
                    : previewData.lines.map((l, i) => (
                      <><tr key={i} onClick={() => setExpandedAcct(expandedAcct === i ? null : i)} style={{ cursor: 'pointer', background: expandedAcct === i ? '#f0f4ff' : '' }}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{previewData.conceptos?.length > 0 ? (expandedAcct === i ? '▼ ' : '▶ ') : ''}{l.code || ''} — {l.name || ''}</td>
                        <td style={{ textAlign: 'right' }}>{l.debit > 0 ? fmtMonto(l.debit) : ''}</td>
                        <td style={{ textAlign: 'right' }}>{l.credit > 0 ? fmtMonto(l.credit) : ''}</td>
                      </tr>
                        {expandedAcct === i && (previewData.conceptos || []).filter((c) => c.code === l.code).map((c, ci) => (
                          <tr key={`c-${ci}`} style={{ background: '#f9fafb', fontSize: '0.7rem' }}>
                            <td style={{ paddingLeft: 28 }}>📎 {c.concepto_codigo} — {c.concepto_nombre}</td>
                            <td style={{ textAlign: 'right' }}>{Number(c.monto) > 0 ? fmtMonto(c.monto) : ''}</td>
                            <td style={{ textAlign: 'right' }}>{Number(c.monto) < 0 ? fmtMonto(Math.abs(c.monto)) : ''}</td>
                          </tr>
                        ))}
                      </>
                    ))}
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
                    <td>TOTALES</td>
                    <td style={{ textAlign: 'right' }}>{fmtMonto(previewData.total_debit)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMonto(previewData.total_credit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 12, fontWeight: 600, fontSize: '0.78rem', background: previewData.balanced ? '#dcfce7' : '#fef2f2', color: previewData.balanced ? '#16a34a' : '#dc2626' }}>
                {previewData.balanced ? '✅ Cuadrado' : '❌ Descuadrado'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" onClick={() => { setShowPreviewModal(false); setPreviewData(null) }}>Cancelar</Button>
              {previewData.lines?.length > 0 && previewData.balanced && (
                <Button size="sm" onClick={handleContabilizar} disabled={contabilizando}>{contabilizando ? '...' : '✅ Aprobar y contabilizar'}</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
