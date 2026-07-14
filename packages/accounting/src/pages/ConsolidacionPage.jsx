import { useEffect, useState } from 'react'
import { useAuth, Button, Skeleton, formatMoney, alertError, MONEDA_POR_PAIS, getSupabase } from '@saas/core'
import { obtenerConsolidacionBalance, obtenerConsolidacionResultados, obtenerConsolidacionAgingAP, obtenerConsolidacionAgingAR, obtenerResumenPorSucursal, listarAsientosConsolidacion, guardarAsientoConsolidacion, contabilizarAsientoConsolidacion, anularAsientoConsolidacion, listarGruposHolding, guardarGrupoHolding, eliminarGrupoHolding, listarMiembrosHolding, agregarMiembroHolding, eliminarMiembroHolding, obtenerBalanceHolding, obtenerResultadosHolding, obtenerResumenPorHolding } from '../data/consolidacion'
import { listarAccounts } from '../data/accounts'
import { listarCierres, cerrarPeriodo, reabrirPeriodo } from '../data/cierre'

const TABS = [
  { key: 'balance', label: '📊 Balance' },
  { key: 'resultados', label: '📈 Resultados' },
  { key: 'sucursales', label: '🏢 Por empresa' },
  { key: 'cierre', label: '🗓 Cierres' },
  { key: 'asientos', label: '📒 Asientos cons.' },
]

export function ConsolidacionPage() {
  const { activeCompanyId, user, pais } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'PYG'
  const [tab, setTab] = useState('balance')
  const [loading, setLoading] = useState(true)

  // Modo: 'sucursal' o 'holding'
  const [modo, setModo] = useState('sucursal')
  const [grupos, setGrupos] = useState([])
  const [grupoId, setGrupoId] = useState('')

  // Datos
  const [balance, setBalance] = useState(null)
  const [resultados, setResultados] = useState(null)
  const [sucursales, setSucursales] = useState([])
  const [asientos, setAsientos] = useState([])
  const [empresaPrincipal, setEmpresaPrincipal] = useState('')
  const [eliminarIC, setEliminarIC] = useState(false)

  // Formulario asiento
  const [showForm, setShowForm] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [asientoForm, setAsientoForm] = useState({ description: '', lines: [{ account_id: '', description: '', debit: 0, credit: 0 }] })
  const [submitting, setSubmitting] = useState(false)

  // Gestión de grupos
  const [showGrupos, setShowGrupos] = useState(false)
  const [nuevoGrupo, setNuevoGrupo] = useState('')
  const [miembros, setMiembros] = useState([])
  const [companiesDisp, setCompaniesDisp] = useState([])

  // Cierres
  const [cierres, setCierres] = useState([])
  const [periodoCierre, setPeriodoCierre] = useState(() => {
    const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
  })

  async function loadGrupos() {
    const g = await listarGruposHolding(activeCompanyId).catch(() => [])
    setGrupos(g)
  }

  async function load() {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const supabase = getSupabase()
      const { data: companies } = await supabase.from('companies').select('id, name').or(`id.eq.${activeCompanyId},parent_company_id.eq.${activeCompanyId}`).order('name')
      const principal = (companies || []).find((c) => c.id === activeCompanyId)
      setEmpresaPrincipal(principal?.name || '')

      const promises = []

      if (modo === 'sucursal') {
        promises.push(
          obtenerConsolidacionBalance(activeCompanyId, eliminarIC).catch(() => null),
          obtenerConsolidacionResultados(activeCompanyId, eliminarIC).catch(() => null),
          obtenerResumenPorSucursal(activeCompanyId).catch(() => []),
        )
      } else if (modo === 'holding' && grupoId) {
        promises.push(
          obtenerBalanceHolding(grupoId, eliminarIC).catch(() => null),
          obtenerResultadosHolding(grupoId, eliminarIC).catch(() => null),
          obtenerResumenPorHolding(grupoId).catch(() => []),
        )
      } else {
        promises.push(null, null, [])
      }

      promises.push(
        listarAsientosConsolidacion(activeCompanyId).catch(() => []),
        listarAccounts(activeCompanyId).catch(() => []),
        listarCierres(activeCompanyId).catch(() => []),
      )

      const [b, r, s, asientosData, accs, cierresData] = await Promise.all(promises)
      setBalance(b)
      setResultados(r)
      setSucursales(s || [])
      setAsientos(asientosData)
      setAccounts(accs)
      setCierres(cierresData)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadGrupos() }, [activeCompanyId])
  useEffect(() => { load() }, [activeCompanyId, eliminarIC, modo, grupoId])

  // Gestión de grupos
  async function handleCrearGrupo() {
    if (!nuevoGrupo.trim()) return
    try {
      await guardarGrupoHolding(activeCompanyId, { nombre: nuevoGrupo.trim() })
      setNuevoGrupo('')
      await loadGrupos()
    } catch (err) { alertError('Error', err.message) }
  }

  async function handleAbrirGrupo(id) {
    setGrupoId(id)
    const m = await listarMiembrosHolding(id).catch(() => [])
    setMiembros(m)
    const all = await getSupabase().from('companies').select('id, name').order('name').then(({ data }) => data || [])
    const idsEnGrupo = new Set(m.map((mm) => mm.company_id))
    setCompaniesDisp(all.filter((c) => !idsEnGrupo.has(c.id)))
    setShowGrupos(true)
  }

  async function handleAgregarEmpresa(companyId) {
    await agregarMiembroHolding(grupoId, companyId)
    const m = await listarMiembrosHolding(grupoId)
    setMiembros(m)
    const idsEnGrupo = new Set(m.map((mm) => mm.company_id))
    setCompaniesDisp((prev) => prev.filter((c) => !idsEnGrupo.has(c.id)))
  }

  async function handleQuitarEmpresa(companyId) {
    await eliminarMiembroHolding(grupoId, companyId)
    setMiembros((prev) => prev.filter((m) => m.company_id !== companyId))
    const { data } = await getSupabase().from('companies').select('id, name').eq('id', companyId).single()
    if (data) setCompaniesDisp((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
  }

  // Asientos
  async function handleCrearAsiento() {
    if (!asientoForm.description.trim()) { alertError('Error', 'Descripción requerida'); return }
    const hasEmpty = asientoForm.lines.some((l) => !l.account_id || (Number(l.debit) <= 0 && Number(l.credit) <= 0))
    if (hasEmpty) { alertError('Error', 'Completá todas las líneas'); return }
    const totalDebit = asientoForm.lines.reduce((s, l) => s + Number(l.debit || 0), 0)
    const totalCredit = asientoForm.lines.reduce((s, l) => s + Number(l.credit || 0), 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) { alertError('Error', 'El asiento no está cuadrado'); return }
    setSubmitting(true)
    try {
      await guardarAsientoConsolidacion(activeCompanyId, user?.id, { ...asientoForm, estado: 'contabilizado' })
      setShowForm(false)
      setAsientoForm({ description: '', lines: [{ account_id: '', description: '', debit: 0, credit: 0 }] })
      load()
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  // ---- Render ----
  if (loading) return <Skeleton.Card />

  function sumTotal(list) {
    return (list || []).reduce((s, i) => s + Number(i.saldo || 0), 0)
  }

  function renderAccountTable(list) {
    if (!list || list.length === 0) return <p className="meta" style={{ padding: 8 }}>Sin datos</p>
    return (
      <div className="table-wrapper">
        <table className="table" style={{ fontSize: '0.82rem' }}>
          <tbody>
            {list.map((item, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600, width: 100 }}>{item.code}</td>
                <td>{item.name}{item.is_intercompany ? <span className="badge" style={{ marginLeft: 6, background: '#fef3c7', color: '#d97706', fontSize: '0.65rem' }}>IC</span> : ''}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(item.saldo || 0, moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function renderBalanceTab() {
    if (!balance) return <p className="meta">Sin datos contables</p>
    const ta = sumTotal(balance.cuentas?.filter((c) => c.type === 'activo'))
    const tp = sumTotal(balance.cuentas?.filter((c) => c.type === 'pasivo'))
    const tpn = sumTotal(balance.cuentas?.filter((c) => c.type === 'patrimonio'))
    const cuadra = Math.abs(ta - tp - tpn) < 1
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="card"><h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12, color: '#2563eb' }}>🏦 Activo</h3>{renderAccountTable(balance.cuentas?.filter((c) => c.type === 'activo'))}
          <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '1rem', marginTop: 8, borderTop: '2px solid var(--color-border)', paddingTop: 8 }}>Total: {formatMoney(ta, moneda)}</div>
        </div>
        <div className="card"><h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12, color: '#d97706' }}>📋 Pasivo</h3>{renderAccountTable(balance.cuentas?.filter((c) => c.type === 'pasivo'))}
          <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '1rem', marginTop: 8, borderTop: '2px solid var(--color-border)', paddingTop: 8 }}>Total: {formatMoney(tp, moneda)}</div>
        </div>
        <div className="card"><h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12, color: '#059669' }}>📋 Patrimonio</h3>{renderAccountTable(balance.cuentas?.filter((c) => c.type === 'patrimonio'))}
          <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '1rem', marginTop: 8, borderTop: '2px solid var(--color-border)', paddingTop: 8 }}>Total: {formatMoney(tpn, moneda)}</div>
        </div>
        <div className="card" style={{ background: cuadra ? '#f0fdf4' : '#fef2f2' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: cuadra ? '#16a34a' : '#dc2626' }}>{cuadra ? '✅ Cuadrado' : '❌ Descadrado'}</div>
          <div className="meta">A {formatMoney(ta, moneda)} − P {formatMoney(tp, moneda)} = {formatMoney(ta - tp, moneda)} · PN: {formatMoney(tpn, moneda)}</div>
        </div>
      </div>
    )
  }

  function renderResultadosTab() {
    if (!resultados) return <p className="meta">Sin datos</p>
    const ing = sumTotal(resultados.cuentas?.filter((c) => c.type === 'ingreso'))
    const cos = sumTotal(resultados.cuentas?.filter((c) => c.type === 'costo'))
    const gas = sumTotal(resultados.cuentas?.filter((c) => c.type === 'gasto'))
    const neto = ing - cos - gas
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="card"><h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12, color: '#16a34a' }}>📈 Ingresos</h3>{renderAccountTable(resultados.cuentas?.filter((c) => c.type === 'ingreso'))}
          <div style={{ textAlign: 'right', fontWeight: 700 }}>Total: {formatMoney(ing, moneda)}</div>
        </div>
        <div className="card"><h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12, color: '#d97706' }}>📉 Costos</h3>{renderAccountTable(resultados.cuentas?.filter((c) => c.type === 'costo'))}
          <div style={{ textAlign: 'right', fontWeight: 700 }}>Total: {formatMoney(cos, moneda)}</div>
        </div>
        <div className="card"><h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12, color: '#dc2626' }}>💸 Gastos</h3>{renderAccountTable(resultados.cuentas?.filter((c) => c.type === 'gasto'))}
          <div style={{ textAlign: 'right', fontWeight: 700 }}>Total: {formatMoney(gas, moneda)}</div>
        </div>
        <div className="card" style={{ background: neto >= 0 ? '#f0fdf4' : '#fef2f2' }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: neto >= 0 ? '#16a34a' : '#dc2626' }}>Resultado Neto: {formatMoney(neto, moneda)}</div>
        </div>
      </div>
    )
  }

  function renderSucursalesTab() {
    const ta = sucursales.reduce((s, r) => s + Number(r.total_activo), 0)
    const tp = sucursales.reduce((s, r) => s + Number(r.total_pasivo), 0)
    const tr = sucursales.reduce((s, r) => s + Number(r.resultado), 0)
    return (
      <div className="card">
        {sucursales.length === 0 ? <p className="meta">Sin empresas</p> : (
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead><tr><th>{modo === 'holding' ? 'Empresa' : 'Sucursal'}</th><th style={{ textAlign: 'right' }}>Activo</th><th style={{ textAlign: 'right' }}>Pasivo</th><th style={{ textAlign: 'right' }}>Resultado</th>{modo === 'holding' && <th style={{ textAlign: 'right' }}>%</th>}</tr></thead>
              <tbody>{sucursales.map((s) => (
                <tr key={s.company_id}>
                  <td style={{ fontWeight: 600 }}>{s.company_name}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(s.total_activo, moneda)}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(s.total_pasivo, moneda)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: Number(s.resultado) >= 0 ? '#16a34a' : '#dc2626' }}>{formatMoney(s.resultado, moneda)}</td>
                  {modo === 'holding' && <td style={{ textAlign: 'right' }}>{Number(s.participacion || 100).toFixed(0)}%</td>}
                </tr>
              ))}</tbody>
              <tfoot><tr style={{ fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
                <td>Total</td><td style={{ textAlign: 'right' }}>{formatMoney(ta, moneda)}</td><td style={{ textAlign: 'right' }}>{formatMoney(tp, moneda)}</td>
                <td style={{ textAlign: 'right', color: tr >= 0 ? '#16a34a' : '#dc2626' }}>{formatMoney(tr, moneda)}</td>
                {modo === 'holding' && <td></td>}
              </tr></tfoot>
            </table>
          </div>
        )}
      </div>
    )
  }

  function renderAsientosTab() {
    const activos = asientos.filter((a) => a.estado === 'contabilizado')
    const borradores = asientos.filter((a) => a.estado === 'borrador')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card">
          <div className="page-header" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>📒 Asientos de consolidación</h3>
            <Button size="sm" onClick={() => setShowForm(true)}>+ Nuevo</Button>
          </div>
          {activos.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f0fdf4', borderRadius: 6, marginBottom: 4, fontSize: '0.82rem' }}>
              <div><span style={{ fontWeight: 600 }}>{a.entry_number}</span> — {a.description}</div>
              <div style={{ fontWeight: 600 }}>D: {formatMoney(a.total_debit, moneda)} / C: {formatMoney(a.total_credit, moneda)}</div>
            </div>
          ))}
          {borradores.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#fffbeb', borderRadius: 6, marginBottom: 4, fontSize: '0.82rem' }}>
              <div><span style={{ fontWeight: 600 }}>{a.entry_number}</span> — {a.description}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={async () => { await contabilizarAsientoConsolidacion(a.id); load() }} style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', fontSize: '0.78rem' }}>✅ Contabilizar</button>
                <button onClick={async () => { await anularAsientoConsolidacion(a.id); load() }} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.78rem' }}>🗑 Anular</button>
              </div>
            </div>
          ))}
          {asientos.length === 0 && <p className="meta" style={{ padding: 16, textAlign: 'center' }}>Sin asientos</p>}
        </div>

        {showForm && (
          <div className="card">
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Nuevo asiento</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <input className="form-input" placeholder="Descripción" value={asientoForm.description} onChange={(e) => setAsientoForm((p) => ({ ...p, description: e.target.value }))} style={{ width: '100%' }} />
            {asientoForm.lines.map((line, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <select className="form-input" value={line.account_id} onChange={(e) => {
                  const lines = [...asientoForm.lines]; lines[idx] = { ...lines[idx], account_id: e.target.value }; setAsientoForm((p) => ({ ...p, lines }))
                }} style={{ flex: 2, fontSize: '0.82rem' }}>
                  <option value="">— Cuenta —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
                <input className="form-input" placeholder="Débito" type="number" min="0" value={line.debit} onChange={(e) => {
                  const lines = [...asientoForm.lines]; lines[idx] = { ...lines[idx], debit: Number(e.target.value) }; setAsientoForm((p) => ({ ...p, lines }))
                }} style={{ width: 100, fontSize: '0.82rem' }} />
                <input className="form-input" placeholder="Crédito" type="number" min="0" value={line.credit} onChange={(e) => {
                  const lines = [...asientoForm.lines]; lines[idx] = { ...lines[idx], credit: Number(e.target.value) }; setAsientoForm((p) => ({ ...p, lines }))
                }} style={{ width: 100, fontSize: '0.82rem' }} />
                {asientoForm.lines.length > 1 && (
                  <button onClick={() => setAsientoForm((p) => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>✕</button>
                )}
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setAsientoForm((p) => ({ ...p, lines: [...p.lines, { account_id: '', description: '', debit: 0, credit: 0 }] }))}>+ Línea</Button>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Button size="sm" onClick={handleCrearAsiento} disabled={submitting}>{submitting ? '...' : '✅ Crear'}</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderCierreTab() {
    const empresasUnicas = [...new Set(sucursales.map((s) => s.company_name))]
    const cierreMap = {}
    cierres.forEach((c) => { cierreMap[c.company_id + '-' + c.periodo] = c })
    const items = empresasUnicas.map((name) => {
      const company = sucursales.find((s) => s.company_name === name)
      if (!company) return null
      const key = company.company_id + '-' + periodoCierre
      const cierre = cierreMap[key]
      return { companyId: company.company_id, companyName: name, cierre }
    }).filter(Boolean)
    return (
      <div className="card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>🗓 Calendario de cierre</h3>
          <input type="month" value={periodoCierre} onChange={(e) => setPeriodoCierre(e.target.value)} className="form-input" style={{ width: 160, fontSize: '0.82rem' }} />
        </div>
        <p className="meta" style={{ fontSize: '0.78rem', marginBottom: 12 }}>
          Marcá qué empresas ya cerraron su mes. Antes de consolidar verificá que todas estén cerradas.
        </p>
        {items.length === 0 ? <p className="meta">Sin empresas</p> : (
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead><tr><th>Empresa</th><th>Estado</th><th>Cerrado en</th><th></th></tr></thead>
              <tbody>{items.map((item) => {
                const abierto = !item.cierre || item.cierre.estado === 'abierto'
                return (
                  <tr key={item.companyId}>
                    <td style={{ fontWeight: 600 }}>{item.companyName}</td>
                    <td><span className="badge" style={{ background: abierto ? '#fef3c7' : '#dcfce7', color: abierto ? '#d97706' : '#16a34a' }}>{abierto ? '⏳ Abierto' : '✅ Cerrado'}</span></td>
                    <td className="meta">{item.cierre?.cerrado_en?.slice(0, 10) || '—'}</td>
                    <td>
                      {abierto ? (
                        <Button size="xs" onClick={async () => { await cerrarPeriodo(item.companyId, periodoCierre, user?.id); setCierres(await listarCierres(activeCompanyId)) }}>Cerrar</Button>
                      ) : (
                        <Button size="xs" variant="ghost" onClick={async () => { await reabrirPeriodo(item.companyId, periodoCierre); setCierres(await listarCierres(activeCompanyId)) }} style={{ color: '#d97706' }}>Reabrir</Button>
                      )}
                    </td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <div>
            <h1>🏢 Consolidación</h1>
            <p className="meta">{empresaPrincipal || 'Empresa'}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={load}>🔄 Recargar</Button>
        </div>

        {/* Selector de modo */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            <input type="radio" name="modo" value="sucursal" checked={modo === 'sucursal'} onChange={() => { setModo('sucursal'); setGrupoId('') }} /> 🏢 Sucursales
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            <input type="radio" name="modo" value="holding" checked={modo === 'holding'} onChange={() => setModo('holding')} /> 🏛 Holding
          </label>
        </div>

        {/* Selector de grupo holding y gestión */}
        {modo === 'holding' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <select className="form-input" value={grupoId} onChange={(e) => setGrupoId(e.target.value)} style={{ width: 250, fontSize: '0.82rem' }}>
              <option value="">— Seleccionar grupo —</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
            <input className="form-input" placeholder="Nuevo grupo" value={nuevoGrupo} onChange={(e) => setNuevoGrupo(e.target.value)} style={{ width: 160, fontSize: '0.82rem' }} />
            <Button size="sm" onClick={handleCrearGrupo} disabled={!nuevoGrupo.trim()}>+ Crear</Button>
            {grupoId && <Button size="sm" variant="ghost" onClick={() => handleAbrirGrupo(grupoId)}>⚙️ Gestionar miembros</Button>}
            {grupos.map((g) => g.id === grupoId && (
              <Button key="del" size="xs" variant="ghost" onClick={async () => { if (window.confirm('¿Eliminar grupo?')) { await eliminarGrupoHolding(g.id); setGrupoId(''); loadGrupos() } }} style={{ color: '#dc2626', fontSize: '0.78rem' }}>🗑</Button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '6px 14px', borderRadius: 6, border: tab === t.key ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
              background: tab === t.key ? 'var(--color-accent)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--color-text)', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Toggle IC */}
      {(tab === 'balance' || tab === 'resultados') && (
        <div className="card" style={{ padding: '8px 16px' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            <input type="checkbox" checked={eliminarIC} onChange={(e) => setEliminarIC(e.target.checked)} style={{ width: 18, height: 18 }} />
            🔗 Eliminar IC
            <span className="meta" style={{ fontSize: '0.75rem' }}>Excluye cuentas intercompañía</span>
          </label>
        </div>
      )}

      {modo === 'holding' && !grupoId ? (
        <div className="card"><p className="meta" style={{ padding: 24, textAlign: 'center' }}>Seleccioná un grupo holding para ver la consolidación</p></div>
      ) : (
        <>
          {tab === 'balance' && renderBalanceTab()}
          {tab === 'resultados' && renderResultadosTab()}
          {tab === 'sucursales' && renderSucursalesTab()}
          {tab === 'asientos' && renderAsientosTab()}
      {tab === 'cierre' && renderCierreTab()}
        </>
      )}

      {/* Modal gestión de grupo */}
      {showGrupos && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowGrupos(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 500, margin: 16, maxHeight: '80vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>⚙️ {grupos.find((g) => g.id === grupoId)?.nombre}</h3>
              <button onClick={() => setShowGrupos(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8 }}>Empresas del grupo</h4>
            {miembros.length === 0 ? <p className="meta">Sin empresas</p> : miembros.map((m) => (
              <div key={m.company_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: '#f9fafb', borderRadius: 6, marginBottom: 4, fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 600 }}>{m.company?.name || m.company_id}</span>
                <button onClick={() => handleQuitarEmpresa(m.company_id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.82rem' }}>✕ Quitar</button>
              </div>
            ))}
            {companiesDisp.length > 0 && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8 }}>Agregar empresa</h4>
                <div style={{ display: 'flex', gap: 8 }}>{companiesDisp.slice(0, 10).map((c) => (
                  <button key={c.id} onClick={() => handleAgregarEmpresa(c.id)} style={{ padding: '4px 10px', border: '1px solid var(--color-border)', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                    + {c.name}
                  </button>
                ))}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
