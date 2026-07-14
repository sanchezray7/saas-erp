import { useEffect, useState, useCallback } from 'react'
import { useAuth, Button, Skeleton, formatMoney, alertError, getSupabase } from '@saas/core'
import { reporteBalance, reporteResultados, reporteIva, reporteMayorContable, reporteBalanceConsolidado, reporteResultadosConsolidado, reporteIvaConsolidado, reporteMayorConsolidado, reporteFlujoEfectivo } from '../data/reports'
import { listarAccounts } from '../data/accounts'

const TABS = ['balance', 'resultados', 'iva', 'flujo', 'mayor']
const TAB_LABEL = { balance: '📊 Balance', resultados: '📈 Resultados', iva: '🧾 IVA', flujo: '💵 Flujo Efectivo', mayor: '📒 Mayor' }
const MONEDA = 'PYG'
function fmt(n) { return formatMoney(n || 0, MONEDA) }

function pct(actual, anterior) {
  if (!anterior) return ''
  const dif = actual - anterior
  const pct = anterior !== 0 ? ((dif / anterior) * 100).toFixed(1) : '∞'
  return { dif, pct: (dif >= 0 ? '+' : '') + pct + '%', color: dif >= 0 ? '#16a34a' : '#dc2626' }
}

function descargarCSV(filas, nombre) {
  const BOM = '\uFEFF'
  const csv = BOM + filas.map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = nombre; a.click()
  URL.revokeObjectURL(url)
}

export function ReportsPage() {
  const { activeCompanyId } = useAuth()
  const [tab, setTab] = useState('balance')
  const [desde, setDesde] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10) })
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [dataAnt, setDataAnt] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [consolidar, setConsolidar] = useState(false)
  const [esMatriz, setEsMatriz] = useState(false)
  const [comparar, setComparar] = useState(false)

  // Período anterior default: mismo rango desplazado 1 mes
  const calcAnt = useCallback(() => {
    const d = new Date(desde); d.setMonth(d.getMonth() - 1)
    const h = new Date(hasta); h.setMonth(h.getMonth() - 1)
    return { desdeAnt: d.toISOString().slice(0, 10), hastaAnt: h.toISOString().slice(0, 10) }
  }, [desde, hasta])
  const [desdeAnt, setDesdeAnt] = useState('')
  const [hastaAnt, setHastaAnt] = useState('')

  useEffect(() => {
    listarAccounts(activeCompanyId).then(setAccounts).catch(() => {})
    getSupabase().from('companies').select('parent_company_id').eq('id', activeCompanyId).single()
      .then(({ data }) => setEsMatriz(!data?.parent_company_id))
      .catch(() => setEsMatriz(false))
  }, [activeCompanyId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      async function fetchOne(desdeParam, hastaParam) {
      if (tab === 'balance') return consolidar ? reporteBalanceConsolidado(activeCompanyId, hastaParam) : reporteBalance(activeCompanyId, hastaParam)
      if (tab === 'resultados') return consolidar ? reporteResultadosConsolidado(activeCompanyId, desdeParam, hastaParam) : reporteResultados(activeCompanyId, desdeParam, hastaParam)
      if (tab === 'flujo') return reporteFlujoEfectivo(activeCompanyId, desdeParam, hastaParam)
      if (tab === 'mayor') return accountId ? (consolidar ? reporteMayorConsolidado(activeCompanyId, accountId, desdeParam, hastaParam, sourceType || null) : reporteMayorContable(activeCompanyId, accountId, desdeParam, hastaParam, sourceType || null)) : null
        return consolidar ? reporteIvaConsolidado(activeCompanyId, desdeParam, hastaParam) : reporteIva(activeCompanyId, desdeParam, hastaParam)
      }
      setData(await fetchOne(desde, hasta))
      setDataAnt(comparar ? await fetchOne(desdeAnt, hastaAnt) : null)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [tab, desde, hasta, desdeAnt, hastaAnt, activeCompanyId, accountId, sourceType, consolidar, comparar])

  useEffect(() => { load() }, [load])

  function buildTree(accounts) {
    const map = {}; const roots = []
    ;(accounts || []).forEach((a) => { map[a.id] = { ...a, children: [], saldo: Number(a.saldo) || 0 } })
    ;(accounts || []).forEach((a) => {
      if (a.parent_id && map[a.parent_id]) map[a.parent_id].children.push(map[a.id])
      else if (!a.parent_id) roots.push(map[a.id])
    })
    function calc(node) { node.children.forEach((c) => { calc(c); node.saldo += c.saldo }); return node }
    roots.forEach(calc)
    return roots
  }

  function renderTree(nodes, depth = 0, mapAnt = {}) {
    return nodes.map((n) => {
      const ant = mapAnt[n.id]
      const v = ant ? pct(n.saldo, ant.saldo) : null
      return (
        <div key={n.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', paddingLeft: 12 + depth * 16, fontSize: '0.82rem', fontWeight: depth === 0 ? 700 : 400, borderBottom: '1px solid var(--color-border)', alignItems: 'center' }}>
            <span style={{ flex: 2 }}>{n.code} {n.name}</span>
            <span style={{ fontWeight: 600, width: 100, textAlign: 'right' }}>{fmt(n.saldo)}</span>
            {comparar && ant && <span style={{ fontWeight: 600, width: 100, textAlign: 'right' }}>{fmt(ant.saldo)}</span>}
            {comparar && v && <span style={{ fontWeight: 600, width: 80, textAlign: 'right', color: v.color }}>{v.pct}</span>}
          </div>
          {n.children.length > 0 && renderTree(n.children, depth + 1, mapAnt)}
        </div>
      )
    })
  }

  function exportCSV(dataActual, dataAnterior, tipo) {
    const filas = [['Cuenta', 'Saldo Actual', comparar ? 'Saldo Anterior' : '', comparar ? 'Variación %' : ''].filter(Boolean)]
    const cuentas = dataActual?.cuentas || []
    const mapAnt = {}
    ;(dataAnterior?.cuentas || []).forEach((c) => { mapAnt[c.id] = c })
    cuentas.forEach((c) => {
      const ant = mapAnt[c.id]
      const v = ant ? pct(Number(c.saldo), Number(ant.saldo)) : null
      filas.push([`${c.code} ${c.name}`, String(Number(c.saldo).toFixed(2)), comparar && ant ? String(Number(ant.saldo).toFixed(2)) : '', comparar && v ? v.pct : ''].filter(Boolean))
    })
    // Totales
    filas.push([''])
    const keys = tipo === 'balance' ? ['total_activo', 'total_pasivo', 'total_patrimonio']
      : tipo === 'resultados' ? ['total_ingresos', 'total_costos', 'total_gastos']
      : tipo === 'iva' ? ['iva_debito', 'iva_credito', 'iva_a_pagar']
      : []
    keys.forEach((k) => {
      filas.push([k, fmt(dataActual?.[k]), comparar ? fmt(dataAnterior?.[k]) : '', comparar ? pct(Number(dataActual?.[k] || 0), Number(dataAnterior?.[k] || 0))?.pct || '' : ''].filter(Boolean))
    })
    descargarCSV(filas, `${tipo}-${hasta}.csv`)
  }

  const dataFuente = { data, dataAnt }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📊 Reportes Contables</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button size="xs" variant="ghost" onClick={() => {
              if (tab === 'balance') exportCSV(data, dataAnt, 'balance')
              else if (tab === 'resultados') exportCSV(data, dataAnt, 'resultados')
              else if (tab === 'iva') exportCSV(data, dataAnt, 'iva')
            }}>📥 CSV</Button>
            {tab === 'mayor' && (
              <select className="form-input" value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ width: 200, fontSize: '0.82rem' }}>
                <option value="">— Cuenta —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Fechas */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <input className="form-input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ width: 130, fontSize: '0.82rem' }} />
          <span className="meta">a</span>
          <input className="form-input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ width: 130, fontSize: '0.82rem' }} />

          {tab === 'mayor' && (
            <select className="form-input" value={sourceType} onChange={(e) => setSourceType(e.target.value)} style={{ width: 110, fontSize: '0.82rem', marginLeft: 8 }}>
              <option value="">Todos</option>
              <option value="factura_proveedor">Compras</option>
              <option value="factura_cliente">Ventas</option>
              <option value="pago_proveedor">Pagos</option>
              <option value="pago_cliente">Cobros</option>
              <option value="manual">Manuales</option>
            </select>
          )}

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, marginLeft: 8 }}>
            <input type="checkbox" checked={comparar} onChange={(e) => {
              setComparar(e.target.checked)
              if (e.target.checked) { const { desdeAnt: da, hastaAnt: ha } = calcAnt(); setDesdeAnt(da); setHastaAnt(ha) }
            }} style={{ width: 16, height: 16 }} />
            📊 Comparar
          </label>
        </div>

        {comparar && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span className="meta" style={{ fontSize: '0.78rem' }}>Período anterior:</span>
            <input className="form-input" type="date" value={desdeAnt} onChange={(e) => setDesdeAnt(e.target.value)} style={{ width: 130, fontSize: '0.82rem' }} />
            <span className="meta">a</span>
            <input className="form-input" type="date" value={hastaAnt} onChange={(e) => setHastaAnt(e.target.value)} style={{ width: 130, fontSize: '0.82rem' }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <Button key={t} size="sm" variant={tab === t ? 'primary' : 'ghost'} onClick={() => setTab(t)}>{TAB_LABEL[t]}</Button>
          ))}
        </div>

        {esMatriz && (
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
              <input type="checkbox" checked={consolidar} onChange={(e) => setConsolidar(e.target.checked)} style={{ width: 18, height: 18 }} />
              🏢 Consolidar sucursales
              <span className="meta">{consolidar ? '(todas las sucursales)' : '(solo esta empresa)'}</span>
            </label>
          </div>
        )}
      </div>

      {loading ? <Skeleton.Card /> : !data ? <p className="meta" style={{ padding: 24, textAlign: 'center' }}>Sin datos</p> : (
        <>
          {/* Balance */}
          {tab === 'balance' && (() => {
            const mapAnt = {}
            ;(dataAnt?.cuentas || []).forEach((c) => { mapAnt[c.id] = c })
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`, gap: 12 }}>
                  {['total_activo', 'total_pasivo', 'total_patrimonio'].map((k) => {
                    const v = comparar ? pct(Number(data[k] || 0), Number(dataAnt?.[k] || 0)) : null
                    const colors = { total_activo: { bg: '#e0f2fe', co: '#0284c7' }, total_pasivo: { bg: '#fef3c7', co: '#d97706' }, total_patrimonio: { bg: '#dcfce7', co: '#16a34a' } }
                    return (
                      <div key={k} style={{ background: colors[k]?.bg || '#f5f5f5', padding: '12px 16px', borderRadius: 8 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: colors[k]?.co }}>{k.replace('total_', '').replace(/_/g, ' ').toUpperCase()}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: colors[k]?.co }}>{fmt(data[k])}</div>
                        {comparar && v && <div style={{ fontSize: '0.82rem', fontWeight: 600, color: v.color }}>{v.pct} vs anterior ({fmt(dataAnt?.[k])})</div>}
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: '0.85rem', color: Math.abs(Number(data.total_activo) - Number(data.total_pasivo) - Number(data.total_patrimonio)) < 1 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                  {Math.abs(Number(data.total_activo) - Number(data.total_pasivo) - Number(data.total_patrimonio)) < 1 ? '✅ Balance cuadrado' : '❌ Descuadrado por ' + fmt(Math.abs(Number(data.total_activo) - Number(data.total_pasivo) - Number(data.total_patrimonio)))}
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 8px' }}>Detalle por cuenta</h3>
                  {renderTree(buildTree(data.cuentas), 0, mapAnt)}
                  {comparar && <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: '0.78rem', color: '#6b7280' }}>
                    <span>📊 <strong>Actual:</strong> {desde} al {hasta}</span>
                    <span>📅 <strong>Anterior:</strong> {desdeAnt} al {hastaAnt}</span>
                  </div>}
                </div>
              </div>
            )
          })()}

          {/* Resultados */}
          {tab === 'resultados' && (() => {
            const mapAnt = {}
            ;(dataAnt?.cuentas || []).forEach((c) => { mapAnt[c.id] = c })
            const neto = Number(data.total_ingresos || 0) - Number(data.total_costos || 0) - Number(data.total_gastos || 0)
            const netoAnt = dataAnt ? Number(dataAnt.total_ingresos || 0) - Number(dataAnt.total_costos || 0) - Number(dataAnt.total_gastos || 0) : null
            const vNeto = comparar && netoAnt != null ? pct(neto, netoAnt) : null
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {['total_ingresos', 'total_costos', 'total_gastos'].map((k) => {
                  const v = comparar ? pct(Number(data[k] || 0), Number(dataAnt?.[k] || 0)) : null
                  const c = { total_ingresos: { bg: '#f0fdf4', co: '#059669' }, total_costos: { bg: '#fef3c7', co: '#d97706' }, total_gastos: { bg: '#fef2f2', co: '#dc2626' } }
                  return (
                    <div key={k} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: c[k]?.co }}>{k.replace('total_', '').replace(/_/g, ' ').toUpperCase()}</h3>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: c[k]?.co }}>{fmt(data[k])}</div>
                          {comparar && v && <div style={{ fontSize: '0.82rem', color: v.color }}>{v.pct} vs {fmt(dataAnt?.[k])}</div>}
                        </div>
                      </div>
                      {renderTree(buildTree(data.cuentas?.filter((c) => c.type === k.replace('total_', '').replace(/s$/, '')) || []), 0, mapAnt)}
                    </div>
                  )
                })}
                <div className="card" style={{ background: neto >= 0 ? '#f0fdf4' : '#fef2f2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>Resultado Neto</div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: neto >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(neto)}</div>
                      {comparar && vNeto && <div style={{ fontSize: '0.85rem', color: vNeto.color }}>{vNeto.pct} vs {fmt(netoAnt)}</div>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* IVA */}
          {tab === 'iva' && (
            <div className="card">
              {['iva_debito', 'iva_credito', 'iva_a_pagar'].map((k) => {
                const v = comparar ? pct(Number(data[k] || 0), Number(dataAnt?.[k] || 0)) : null
                const lb = { iva_debito: 'IVA Débito', iva_credito: 'IVA Crédito', iva_a_pagar: 'IVA a Pagar' }
                return (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ fontWeight: 600 }}>{lb[k]}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700 }}>{fmt(data[k])}</span>
                      {comparar && v && <span style={{ marginLeft: 12, fontSize: '0.82rem', color: v.color }}>{v.pct}</span>}
                    </div>
                  </div>
                )
              })}
              {data.detalle && (
                <div style={{ marginTop: 12 }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8 }}>Detalle por tasa</h4>
                  {data.detalle.map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                      <span>{d.tipo === 'debito_fiscal' ? '🧾' : '📄'} {d.tasa}</span>
                      <span style={{ fontWeight: 600 }}>{fmt(d.monto)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Flujo de Efectivo */}
          {tab === 'flujo' && data?.detalle && (
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16 }}>💵 Flujo de Efectivo</h3>
              <p className="meta" style={{ fontSize: '0.82rem', marginBottom: 12 }}>Período: {desde} al {hasta}</p>
              {data.detalle.map((item, i) => {
                const isTotal = item.tipo === 'total'
                const isAjuste = item.tipo === 'ajuste'
                const isCapital = item.tipo === 'capital_trabajo'
                return (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                    borderBottom: '1px solid var(--color-border)',
                    fontWeight: isTotal ? 700 : isAjuste || isCapital ? 400 : 600,
                    fontSize: isTotal ? '0.95rem' : '0.85rem',
                    paddingLeft: isAjuste || isCapital ? 24 : 0,
                    color: isTotal ? (Number(item.monto) >= 0 ? '#16a34a' : '#dc2626') : undefined,
                  }}>
                    <span>{item.concepto}</span>
                    <span style={{ fontWeight: 700 }}>{fmt(item.monto)}</span>
                  </div>
                )
              })}
              <div className="meta" style={{ marginTop: 12, borderTop: '2px solid var(--color-border)', paddingTop: 8, fontSize: '0.78rem' }}>
                <strong>Nota:</strong> Flujo por método indirecto simplificado. Solo incluye variaciones de capital de trabajo.
              </div>
            </div>
          )}

          {/* Mayor */}
          {tab === 'mayor' && data?.movimientos && (
            <div className="card">
              <div style={{ marginBottom: 8, fontSize: '0.85rem' }}>
                Saldo inicial: <strong>{fmt(data.saldo_inicial)}</strong>
              </div>
              <div className="table-wrapper">
                <table className="table" style={{ fontSize: '0.82rem' }}>
                  <thead><tr><th>Fecha</th><th>N°</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Débito</th><th style={{ textAlign: 'right' }}>Crédito</th></tr></thead>
                  <tbody>
                    {data.movimientos.map((m, i) => (
                      <tr key={i}>
                        <td className="meta">{m.fecha?.slice(0, 10)}</td>
                        <td style={{ fontFamily: 'monospace' }}>{m.entry_number}</td>
                        <td>{m.descripcion}</td>
                        <td style={{ textAlign: 'right' }}>{m.debit > 0 ? fmt(m.debit) : ''}</td>
                        <td style={{ textAlign: 'right' }}>{m.credit > 0 ? fmt(m.credit) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
