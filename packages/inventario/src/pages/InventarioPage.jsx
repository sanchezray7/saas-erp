import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, alertError } from '@saas/core'
import { listarStockGeneral, listarAlmacenes, registrarMovimientoStock } from '../data/inventario'

export function InventarioPage() {
  const { activeCompanyId, user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAjuste, setShowAjuste] = useState(null)
  const [almacenes, setAlmacenes] = useState([])
  const [ajusteForm, setAjusteForm] = useState({})

  const load = useCallback(async () => {
    try {
      setData(await listarStockGeneral(activeCompanyId))
      setAlmacenes(await listarAlmacenes(activeCompanyId))
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  function openAjuste(item) {
    setShowAjuste(item)
    setAjusteForm({ tipo: 'ajuste', cantidad: 0, motivo: '', almacen_id: item.almacen_id })
  }

  async function handleAjustar() {
    if (!ajusteForm.cantidad || !ajusteForm.motivo) return
    try {
      const cantidad = Number(ajusteForm.cantidad)
      await registrarMovimientoStock(activeCompanyId, user?.id, {
        producto_id: showAjuste.producto_id,
        almacen_id: ajusteForm.almacen_id,
        tipo: cantidad > 0 ? 'entrada' : 'salida',
        cantidad: Math.abs(cantidad),
        motivo: ajusteForm.motivo,
      })
      notify('Stock ajustado')
      setShowAjuste(null)
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  const filtered = data.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.producto?.nombre?.toLowerCase().includes(q) || s.producto?.codigo?.toLowerCase().includes(q)
  })

  // Agrupar por producto para mostrar stock total
  const grouped = {}
  filtered.forEach((s) => {
    const key = s.producto_id
    if (!grouped[key]) grouped[key] = { producto: s.producto, almacenes: [], total: 0, minimo: Number(s.stock_minimo) }
    grouped[key].almacenes.push(s)
    grouped[key].total += Number(s.cantidad)
    if (Number(s.stock_minimo) > 0) grouped[key].minimo = Math.min(grouped[key].minimo, Number(s.stock_minimo))
  })

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📦 Inventario</h1>
          <Link to="/movimientos-stock"><Button variant="ghost" size="sm">Movimientos</Button></Link>
        </div>

        <div style={{ marginBottom: 12 }}>
          <input type="search" placeholder="Buscar producto..." className="form-input" style={{ width: '100%', maxWidth: 320 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {Object.keys(grouped).length === 0 ? (
          <p className="meta" style={{ textAlign: 'center', padding: 24 }}>Sin productos con stock</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.values(grouped).map((g) => {
              const pct = g.minimo > 0 ? (g.total / g.minimo) * 100 : 100
              const color = pct >= 100 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'
              return (
                <div key={g.producto.id} style={{ padding: '8px 12px', background: 'var(--bg-soft)', borderRadius: 6, fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div>
                      <Link to={`/catalogo`} className="link" style={{ fontWeight: 600 }}>{g.producto.nombre}</Link>
                      <span className="meta" style={{ marginLeft: 6 }}>{g.producto.codigo || ''}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color }}>{g.total}</span>
                      {g.minimo > 0 && <span className="meta" style={{ fontSize: '0.72rem' }}>Mín: {g.minimo}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {g.almacenes.map((s) => (
                      <span key={s.id} className="badge" style={{
                        fontSize: '0.72rem', background: '#f3f4f6', color: '#374151',
                      }}>{s.almacen?.nombre || '—'}
                        {s.ubicacion ? ` · ${s.ubicacion.nombre} (${s.ubicacion.pasillo || ''} ${s.ubicacion.estante || ''} ${s.ubicacion.posicion || ''})` : ''}: {Number(s.cantidad)}</span>
                    ))}
                    <Button size="xs" variant="ghost" onClick={() => openAjuste(g.almacenes[0])} style={{ fontSize: '0.7rem' }}>Ajustar</Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal ajuste */}
      {showAjuste && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowAjuste(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 400, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Ajustar stock</h3>
              <button onClick={() => setShowAjuste(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ fontWeight: 600, marginBottom: 12 }}>{showAjuste.producto?.nombre}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select className="form-input" value={ajusteForm.almacen_id} onChange={(e) => setAjusteForm((p) => ({ ...p, almacen_id: e.target.value }))}>
                {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
              <input className="form-input" type="number" placeholder="Cantidad (+ entrada / - salida)" value={ajusteForm.cantidad} onChange={(e) => setAjusteForm((p) => ({ ...p, cantidad: e.target.value }))} />
              <input className="form-input" placeholder="Motivo del ajuste" value={ajusteForm.motivo} onChange={(e) => setAjusteForm((p) => ({ ...p, motivo: e.target.value }))} />
              <Button onClick={handleAjustar} disabled={!ajusteForm.cantidad || !ajusteForm.motivo}>Confirmar ajuste</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
