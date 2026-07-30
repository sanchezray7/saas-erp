import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, notify, alertError, getSupabase, MONEDA_POR_PAIS } from '@saas/core'
import { generarOCs, optimizarConIA } from '../data/sugerenciasOC'
import { listarProductos } from '@saas/productos'

export function IntelligentPurchasePage() {
  const { activeCompanyId, pais } = useAuth()
  const navigate = useNavigate()
  const monedaLocal = MONEDA_POR_PAIS[pais] || 'PYG'
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState({})
  const [asignaciones, setAsignaciones] = useState({})
  const [justificaciones, setJustificaciones] = useState({})
  // Mapa de proveedores por producto: { [producto_id]: [{ proveedor_id, proveedor_nombre, precio, moneda }] }
  const [provPorProducto, setProvPorProducto] = useState({})
  const [loading, setLoading] = useState(true)
  const [cargandoProv, setCargandoProv] = useState(false)
  const [optimizando, setOptimizando] = useState(false)
  const [generando, setGenerando] = useState(false)

  const load = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const data = await listarProductos(activeCompanyId, false)
      setProductos(data || [])
      // Cargar proveedores de TODOS los productos en lote
      setCargandoProv(true)
      const { data: ppData } = await getSupabase().from('proveedor_productos')
        .select('producto_id, proveedor_id, precio_proveedor, moneda, proveedor:proveedores!proveedor_id(nombre)')
        .in('producto_id', (data || []).filter((p) => p.tipo !== 'servicio').map((p) => p.id))
      const map = {}
      for (const row of (ppData || [])) {
        if (!map[row.producto_id]) map[row.producto_id] = []
        map[row.producto_id].push({
          proveedor_id: row.proveedor_id,
          proveedor_nombre: row.proveedor?.nombre || '?',
          precio: Number(row.precio_proveedor || 0),
          moneda: row.moneda || monedaLocal,
        })
      }
      setProvPorProducto(map)
      setCargandoProv(false)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId, monedaLocal])

  useEffect(() => { load() }, [load])

  const filtrados = productos.filter((p) => {
    if (p.tipo === 'servicio') return false
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q)
  })

  function toggleProducto(id) {
    setSeleccion((prev) => {
      if (prev[id]) { const { [id]: _, ...rest } = prev; return rest }
      return { ...prev, [id]: 1 }
    })
  }

  function setCantidad(id, cant) {
    setSeleccion((prev) => ({ ...prev, [id]: Math.max(0, cant || 0) }))
  }

  function setProveedor(productoId, proveedorId) {
    setAsignaciones((prev) => ({ ...prev, [productoId]: proveedorId }))
  }

  function getPrecioProveedor(productoId, proveedorId) {
    const provs = provPorProducto[productoId] || []
    const p = provs.find((pr) => pr.proveedor_id === proveedorId)
    return p?.precio || 0
  }

  function getMonedaProveedor(productoId, proveedorId) {
    const provs = provPorProducto[productoId] || []
    const p = provs.find((pr) => pr.proveedor_id === proveedorId)
    return p?.moneda || monedaLocal
  }

  const seleccionados = productos.filter((p) => seleccion[p.id] > 0)

  async function handleOptimizar() {
    if (seleccionados.length === 0) return
    // Armar items con proveedores desde el cache
    const items = seleccionados.map((p) => ({
      producto_id: p.id,
      producto_nombre: p.nombre,
      producto_codigo: p.codigo || '',
      stock_total: 0,
      stock_minimo: 0,
      tipo: p.tipo || 'producto',
      proveedores: provPorProducto[p.id] || [],
    })).filter((it) => it.proveedores.length > 0)

    if (items.length === 0) { alertError('Error', 'Ningún producto tiene proveedores asociados'); return }

    setOptimizando(true)
    try {
      const result = await optimizarConIA(activeCompanyId, items)
      const sug = result?.sugerencias || []
      const nuevasAsig = { ...asignaciones }
      const nuevasJust = { ...justificaciones }

      for (const s of sug) {
        const match = items.find((it) =>
          it.producto_nombre === s.producto_nombre ||
          it.producto_codigo === s.producto_id ||
          it.producto_id === s.producto_id
        )
        if (!match || !s.proveedor_id) continue
        const provMatch = match.proveedores.find((pr) =>
          pr.proveedor_id === s.proveedor_id || pr.proveedor_nombre === s.proveedor_id
        )
        if (!provMatch) continue
        nuevasAsig[match.producto_id] = provMatch.proveedor_id
        nuevasJust[match.producto_id] = s.justificacion || 'Optimizado por IA'
      }

      setAsignaciones(nuevasAsig)
      setJustificaciones(nuevasJust)

      setSeleccion((prev) => {
        const next = { ...prev }
        items.forEach((it) => { if (!next[it.producto_id]) next[it.producto_id] = 1 })
        return next
      })

      notify(`🤖 IA optimizó ${Object.keys(nuevasAsig).length} producto(s)`)
    } catch (err) { alertError('Error', err.message) }
    finally { setOptimizando(false) }
  }

  async function handleGenerar() {
    const itemsParaOC = seleccionados.filter((p) => asignaciones[p.id])
    if (itemsParaOC.length === 0) { alertError('Error', 'Seleccioná un proveedor para cada producto'); return }
    setGenerando(true)
    try {
      const lista = itemsParaOC.map((p) => {
        const provId = asignaciones[p.id]
        const precio = getPrecioProveedor(p.id, provId)
        return {
          producto_id: p.id,
          producto_nombre: p.nombre,
          stock_total: 0,
          stock_minimo: 0,
          proveedores: [{ proveedor_id: provId, proveedor_nombre: '', precio, moneda: getMonedaProveedor(p.id, provId) }],
        }
      })
      const creadas = await generarOCs(activeCompanyId, lista, asignaciones)
      notify(`${creadas.length} OC(s) generada(s): ${creadas.map((c) => c.numero).join(', ')}`)
      if (creadas.length === 1) navigate(`/ordenes-compra/${creadas[0].id}`)
      else navigate('/ordenes-compra')
    } catch (err) { alertError('Error al generar OCs', err.message) }
    finally { setGenerando(false) }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <div>
            <h1>🤖 Compra inteligente</h1>
            <p className="meta">
              {Object.keys(seleccion).length} seleccionado(s)
              {Object.keys(asignaciones).length > 0 && ` · 🤖 ${Object.keys(justificaciones).length} optimizado(s)`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {seleccionados.length > 0 && (
              <>
                <Button onClick={handleOptimizar} disabled={optimizando || cargandoProv} variant="ghost">
                  {optimizando ? 'Optimizando...' : '🤖 Optimizar con IA'}
                </Button>
                <Button onClick={handleGenerar} disabled={generando || Object.keys(asignaciones).length === 0}>
                  {generando ? 'Generando...' : '📋 Crear OC(s)'}
                </Button>
              </>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <input type="search" placeholder="Buscar productos por nombre o código..." className="form-input"
            style={{ width: '100%', maxWidth: 400, fontSize: '0.85rem' }}
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>

        {filtrados.length === 0 ? (
          <p className="meta" style={{ textAlign: 'center', padding: 24 }}>Sin productos. Creá productos en el catálogo.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Producto</th>
                  <th>Código</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Cantidad</th>
                  <th style={{ minWidth: 180 }}>Proveedor</th>
                  <th style={{ textAlign: 'right' }}>Precio</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                  <th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const sel = seleccion[p.id] > 0
                  const provId = asignaciones[p.id]
                  const just = justificaciones[p.id]
                  const provs = provPorProducto[p.id] || []
                  const precio = getPrecioProveedor(p.id, provId)
                  const monedaProv = getMonedaProveedor(p.id, provId)
                  const cant = sel ? (seleccion[p.id] || 0) : 0
                  const subtotal = cant * precio
                  return (
                    <tr key={p.id} style={{ opacity: sel ? 1 : 0.6 }}>
                      <td><input type="checkbox" checked={sel} onChange={() => toggleProducto(p.id)} /></td>
                      <td>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {p.nombre}
                          {just && <span title={just} style={{ cursor: 'help', fontSize: '0.72rem', color: '#16a34a' }}>🤖</span>}
                        </div>
                      </td>
                      <td className="meta">{p.codigo || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="number" min="0" value={sel ? cant : ''}
                          onChange={(e) => sel && setCantidad(p.id, Number(e.target.value))}
                          style={{ width: 65, padding: '4px 6px', textAlign: 'right', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}
                          disabled={!sel} />
                      </td>
                      <td>
                        {sel && provs.length > 0 ? (
                          <select value={provId || ''} onChange={(e) => setProveedor(p.id, e.target.value)}
                            style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.82rem', background: 'var(--color-surface)' }}>
                            <option value="">— Seleccionar —</option>
                            {provs.map((pr) => (
                              <option key={pr.proveedor_id} value={pr.proveedor_id}>
                                {pr.proveedor_nombre} ({formatMoney(pr.precio, pr.moneda)})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="meta" style={{ fontSize: '0.78rem' }}>
                            {sel ? 'Sin proveedor' : '—'}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {provId ? formatMoney(precio, monedaProv) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {provId && cant > 0 ? formatMoney(subtotal, monedaProv) : '—'}
                      </td>
                      <td>
                        {sel && <button onClick={() => toggleProducto(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
