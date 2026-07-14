import { useEffect, useState } from 'react'
import { useAuth, Button, Skeleton, alertError, notify, PERMISSIONS, getSupabase } from '@saas/core'
import { listarConceptos, guardarConcepto, eliminarConcepto, conceptosSeedPY } from '../data/conceptos'
import { obtenerConfig, guardarConfig } from '../data/config'

export function ConfigNominaPage() {
  const { activeCompanyId, can } = useAuth()
  const puedeEditar = can(PERMISSIONS.NOMINA_CONFIG)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ codigo: '', nombre: '', tipo: 'remunerativo', formula: '', porcentaje: '', orden: 0, orden_calculo: '', es_imponible_ips: false, es_imponible_irp: false, account_id: '' })
  const [submitting, setSubmitting] = useState(false)
  const [config, setConfig] = useState({ frecuencia: 'mensual', dia_cierre: 0, dia_pago: 5, numero_patronal: '' })
  const [configLoading, setConfigLoading] = useState(true)
  const [openSection, setOpenSection] = useState(null)
  const [accounts, setAccounts] = useState([])

  useEffect(() => {
    const supabase = getSupabase()
    Promise.all([
      listarConceptos(activeCompanyId).then(setData),
      obtenerConfig(activeCompanyId).then(setConfig),
      supabase.from('accounts').select('id, code, name').eq('company_id', activeCompanyId).in('type', ['gasto', 'pasivo']).order('code').then(r => setAccounts(r.data || [])),
    ]).catch(() => {}).finally(() => { setLoading(false); setConfigLoading(false) })
  }, [activeCompanyId])

  async function handleSaveConfig() {
    setSubmitting(true)
    try {
      await guardarConfig(activeCompanyId, config)
      notify('Configuración guardada')
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  function resetForm() { setForm({ codigo: '', nombre: '', tipo: 'remunerativo', formula: '', porcentaje: '', orden: 0, orden_calculo: '', es_imponible_ips: false, es_imponible_irp: false, account_id: '' }); setEditId(null) }

  async function handleSave() {
    if (!form.codigo || !form.nombre || !form.tipo) { alertError('Error', 'Código, nombre y tipo requeridos'); return }
    setSubmitting(true)
    try {
      await guardarConcepto(activeCompanyId, editId ? { ...form, id: editId } : form)
      notify(editId ? 'Concepto actualizado' : 'Concepto creado')
      resetForm(); setData(await listarConceptos(activeCompanyId))
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  async function handleEliminar(id) {
    if (!window.confirm('¿Eliminar este concepto?')) return
    try { await eliminarConcepto(id); setData(await listarConceptos(activeCompanyId)) }
    catch (err) { alertError('Error', err.message) }
  }

  async function handleSeed() {
    if (!window.confirm('¿Crear conceptos por defecto PY?')) return
    setSubmitting(true)
    try {
      for (const c of conceptosSeedPY) {
        await guardarConcepto(activeCompanyId, c).catch(() => {})
      }
      notify('Conceptos PY creados')
      setData(await listarConceptos(activeCompanyId))
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  function toggleSection(id) {
    setOpenSection((prev) => (prev === id ? null : id))
  }

  const conceptosFaltantes = conceptosSeedPY.filter((s) => !data.find((c) => c.codigo === s.codigo))

  if (loading) return <Skeleton.Card />

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="page-header" style={{ padding: '20px 24px 0' }}>
        <h1>⚙️ Configuración de nómina</h1>
      </div>

      {/* ── Períodos ── */}
      {!configLoading && (
        <details
          className="config-section"
          open={openSection === 'periodos'}
          onToggle={(e) => setOpenSection(e.target.open ? 'periodos' : null)}
        >
          <summary className="config-section__summary">📅 Períodos</summary>
          <div className="config-table-wrap">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div><div className="meta">Frecuencia</div>
                <select className="form-input" value={config.frecuencia} onChange={(e) => setConfig((p) => ({ ...p, frecuencia: e.target.value }))} style={{ width: '100%' }} disabled={!puedeEditar}>
                  <option value="semanal">Semanal</option>
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                </select>
              </div>
              <div><div className="meta">Cierre</div>
                <select className="form-input" value={config.dia_cierre} onChange={(e) => setConfig((p) => ({ ...p, dia_cierre: Number(e.target.value) }))} style={{ width: '100%' }} disabled={!puedeEditar}>
                  <option value={0}>Fin de mes</option>
                  <option value={5}>Día 5</option>
                  <option value={10}>Día 10</option>
                  <option value={15}>Día 15</option>
                  <option value={20}>Día 20</option>
                  <option value={25}>Día 25</option>
                </select>
              </div>
              <div><div className="meta">Pago</div>
                <select className="form-input" value={config.dia_pago} onChange={(e) => setConfig((p) => ({ ...p, dia_pago: Number(e.target.value) }))} style={{ width: '100%' }} disabled={!puedeEditar}>
                  <option value={1}>Día 1</option>
                  <option value={5}>Día 5</option>
                  <option value={10}>Día 10</option>
                  <option value={15}>Día 15</option>
                  <option value={20}>Día 20</option>
                  <option value={25}>Día 25</option>
                  <option value={30}>Día 30</option>
                </select>
              </div>
              <div><div className="meta">N° Patronal IPS</div>
                <input className="form-input" value={config.numero_patronal || ''} onChange={(e) => setConfig((p) => ({ ...p, numero_patronal: e.target.value }))} placeholder="Ej: 12345678" style={{ width: '100%' }} disabled={!puedeEditar} />
              </div>
            </div>
            {puedeEditar && (
              <Button size="sm" onClick={handleSaveConfig} disabled={submitting} style={{ marginTop: 12 }}>
                {submitting ? '...' : '💾 Guardar configuración'}
              </Button>
            )}
          </div>
        </details>
      )}

      {/* ── Conceptos ── */}
      <details
        className="config-section"
        open={openSection === 'conceptos'}
        onToggle={(e) => setOpenSection(e.target.open ? 'conceptos' : null)}
      >
        <summary className="config-section__summary">
          📋 Conceptos
          <span className="config-section__count">{data.length} registros</span>
          {puedeEditar && conceptosFaltantes.length > 0 && (
            <button onClick={handleSeed} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '0.75rem', marginLeft: 8 }}>
              📥 Cargar PY ({conceptosFaltantes.length})
            </button>
          )}
        </summary>
        <div className="config-table-wrap">
          {/* Formulario nuevo / editar */}
          {puedeEditar && (
            <form onSubmit={(e) => e.preventDefault()} className="config-form-inline">
              <div><div className="form-label">Código</div><input className="form-input" value={form.codigo} onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))} placeholder="HE50" style={{ width: 100, fontSize: '0.82rem' }} /></div>
              <div><div className="form-label">Nombre</div><input className="form-input" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Hora extra 50%" style={{ width: 160, fontSize: '0.82rem' }} /></div>
              <div><div className="form-label">Tipo</div>
                <select className="form-input" value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))} style={{ width: 140, fontSize: '0.82rem' }}>
                  <option value="remunerativo">Remunerativo</option>
                  <option value="no_remunerativo">No remunerativo</option>
                  <option value="deduccion">Deducción</option>
                  <option value="aporte_patronal">Aporte patronal</option>
                </select>
              </div>
              <div><div className="form-label">Fórmula</div><input className="form-input" value={form.formula} onChange={(e) => setForm((p) => ({ ...p, formula: e.target.value }))} placeholder="Opcional" style={{ width: 140, fontSize: '0.82rem' }} /></div>
              <div><div className="form-label">%</div><input className="form-input" type="number" step="0.01" value={form.porcentaje} onChange={(e) => setForm((p) => ({ ...p, porcentaje: e.target.value }))} placeholder="Ej: 9" style={{ width: 70, fontSize: '0.82rem' }} /></div>
              <div><div className="form-label">Orden</div><input className="form-input" type="number" value={form.orden} onChange={(e) => setForm((p) => ({ ...p, orden: e.target.value }))} style={{ width: 60, fontSize: '0.82rem' }} /></div>
              <div><div className="form-label">Ord. cálculo</div><input className="form-input" type="number" value={form.orden_calculo} onChange={(e) => setForm((p) => ({ ...p, orden_calculo: e.target.value }))} style={{ width: 60, fontSize: '0.82rem' }} /></div>
              <div><div className="form-label">Cuenta contable</div>
                <select className="form-input" value={form.account_id} onChange={(e) => setForm((p) => ({ ...p, account_id: e.target.value }))} style={{ width: 160, fontSize: '0.82rem' }}>
                  <option value="">— Sin cuenta —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, paddingBottom: 2 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.es_imponible_ips === true} onChange={(e) => setForm((p) => ({ ...p, es_imponible_ips: e.target.checked }))} />
                  IPS
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.es_imponible_irp === true} onChange={(e) => setForm((p) => ({ ...p, es_imponible_irp: e.target.checked }))} />
                  IRP
                </label>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 2 }}>
                <Button size="sm" type="submit" onClick={handleSave} disabled={submitting}>{submitting ? '...' : editId ? '💾 Actualizar' : '➕ Crear'}</Button>
                {editId && <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>}
              </div>
            </form>
          )}

          {data.length === 0 ? (
            <p className="meta" style={{ padding: 16, textAlign: 'center' }}>
              Sin conceptos. Usá el botón "📥 Cargar PY" de arriba o crealos manualmente.
            </p>
          ) : (
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ fontSize: '0.82rem', minWidth: 900 }}>
                <thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>%</th><th>Orden</th><th>Calc</th><th>IPS</th><th>IRP</th><th>Cuenta</th><th>Activo</th><th></th></tr></thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c.id}>
                      <td data-label="Código" style={{ fontWeight: 600, fontFamily: 'monospace' }}>{c.codigo}</td>
                      <td data-label="Nombre">{c.nombre}</td>
                      <td data-label="Tipo"><span className="badge" style={{
                        background: c.tipo === 'remunerativo' ? '#dcfce7' : c.tipo === 'deduccion' ? '#fef2f2' : c.tipo === 'aporte_patronal' ? '#fef3c7' : '#f3f4f6',
                        color: c.tipo === 'remunerativo' ? '#16a34a' : c.tipo === 'deduccion' ? '#dc2626' : c.tipo === 'aporte_patronal' ? '#d97706' : '#6b7280',
                      }}>{c.tipo}</span></td>
                      <td data-label="%">{c.porcentaje ? `${c.porcentaje}%` : '—'}</td>
                      <td data-label="Orden">{c.orden}</td>
                      <td data-label="Calc">{c.orden_calculo || '—'}</td>
                      <td data-label="IPS">{c.es_imponible_ips ? '✅' : '—'}</td>
                      <td data-label="IRP">{c.es_imponible_irp ? '✅' : '—'}</td>
                      <td data-label="Cuenta" style={{ fontSize: '0.72rem' }}>{(accounts.find((a) => a.id === c.account_id))?.code || '—'}</td>
                      <td data-label="Activo">{c.activo ? '✅' : '❌'}</td>
                      <td>{puedeEditar && <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => { setEditId(c.id); setForm(c) }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.82rem' }}>✏️</button>
                        <button onClick={() => handleEliminar(c.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.82rem' }}>🗑</button>
                      </div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
    </div>
  )
}
