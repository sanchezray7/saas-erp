import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, notify, alertError, getSupabase } from '@saas/core'
import { generarOCs, optimizarConIA } from '../data/sugerenciasOC'
import { listarProductos } from '@saas/productos'

export function IntelligentPurchasePage() {
  const { activeCompanyId } = useAuth()
  const navigate = useNavigate()
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState({})       // { [producto_id]: cantidad }
  const [asignaciones, setAsignaciones] = useState({})  // { [producto_id]: proveedor_id }
  const [justificaciones, setJustificaciones] = useState({})
  const [loading, setLoading] = useState(true)
  const [optimizando, setOptimizando] = useState(false)
  const [generando, setGenerando] = useState(false)

  const load = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const data = await listarProductos(activeCompanyId, false)
      setProductos(data || [])
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  const filtrados = productos.filter((p) => {
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

  function getPrecio(productoId, proveedorId) {
    if (!proveedorId) return 0
    const p = productos.find((pr) => pr.id === productoId)
    return Number(p?.precio_compra || 0)
  }

  const seleccionados = productos.filter((p) => seleccion[p.id] > 0)

  async function handleOptimizar() {
    const items = seleccionados.map((p) => {
      const catAlm = { materia_prima: true, manufacturado: true, producto: true, subproducto: true, insumo: true }
      return {
        producto_id: p.id,
        producto_nombre: p.nombre,
        producto_codigo: p.codigo || '',
        stock_total: 0,
        stock_minimo: 0,
        tipo: p.tipo || 'producto',
        proveedores: [], // se cargan debajo
      }
    })
    if (items.length === 0) return

    // Cargar proveedores para cada producto
    setOptimizando(true)
    try {
      for (const item of items) {
        const { data } = await getSupabase().from('proveedor_productos')
          .select('proveedor_id, precio_proveedor, moneda, proveedor:proveedores!proveedor_id(nombre)')
          .eq('producto_id', item.producto_id)
        item.proveedores = (data || []).map((pp) => ({
          proveedor_id: pp.proveedor_id,
          proveedor_nombre: pp.proveedor?.nombre || '?',
          precio: Number(pp.precio_proveedor || 0),
          moneda: pp.moneda || 'PYG',
        }))
      }

      const result = await optimizarConIA(activeCompanyId, items)
      const sug = result?.sugerencias || []
      const nuevasAsig = {}
      const nuevasJust = {}

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

      // Pre-llenar cantidades si no se definieron
      setSeleccion((prev) => {
        const next = { ...prev }
        items.forEach((it) => {
          if (!next[it.producto_id]) next[it.producto_id] = 1
        })
        return next
      })

      notify(`🤖 IA optimizó ${Object.keys(nuevasAsig).length} producto(s)`)
    } catch (err) { alertError('Error', err.message) }
    finally { setOptimizando(false) }
  }

  async function handleGenerar() {
    const itemsParaOC = seleccionados.filter((p) => asignaciones[p.id])
    if (itemsParaOC.length === 0) { alertError('Error', 'Primero optimizá con IA para asignar proveedores'); return }

    setGenerando(true)
    try {
      // Construir estructura similar a SugerenciasOCPage
      const lista = itemsParaOC.map((p) => {
        const provId = asignaciones[p.id]
        const prov = [] // no necesitamos todos los proveedores, solo el asignado
        return {
          producto_id: p.id,
          producto_nombre: p.nombre,
          stock_total: 0,
          stock_minimo: 0,
          proveedores: [{ proveedor_id: provId, proveedor_nombre: '', precio: getPrecio(p.id, provId), moneda: 'PYG' }],
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
              {Object.keys(seleccion).length} producto(s) seleccionados
              {Object.keys(asignaciones).length > 0 && ` · 🤖 ${Object.keys(asignaciones).length} optimizado(s)`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {seleccionados.length > 0 && (
              <>
                <Button onClick={handleOptimizar} disabled={optimizando} variant="ghost">
                  {optimizando ? 'Optimizando...' : '🤖 Optimizar con IA'}
                </Button>
                <Button onClick={handleGenerar} disabled={generando || Object.keys(asignaciones).length === 0}>
                  {generando ? 'Generando...' : `📋 Crear OC(s)`}
                </Button>
              </>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <input
            type="search"
            placeholder="Buscar productos por nombre o código..."
            className="form-input"
            style={{ width: '100%', maxWidth: 400, fontSize: '0.85rem' }}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
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
                  <th>Tipo</th>
                  <th style={{ textAlign: 'right' }}>Precio compra</th>
                  <th style={{ width: 100, textAlign: 'center' }}>Cantidad</th>
                  <th>Proveedor</th>
                  <th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const sel = seleccion[p.id] > 0
                  const provId = asignaciones[p.id]
                  const just = justificaciones[p.id]
                  return (
                    <tr key={p.id} style={{ opacity: sel ? 1 : 0.6 }}>
                      <td>
                        <input type="checkbox" checked={sel} onChange={() => toggleProducto(p.id)} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {p.nombre}
                          {just && <span title={just} style={{ cursor: 'help', fontSize: '0.72rem', color: '#16a34a' }}>🤖</span>}
                        </div>
                      </td>
                      <td className="meta">{p.codigo || '—'}</td>
                      <td style={{ fontSize: '0.78rem' }}>{p.tipo || 'producto'}</td>
                      <td style={{ textAlign: 'right' }}>{p.precio_compra ? `$${Number(p.precio_compra).toLocaleString()}` : '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          value={sel ? seleccion[p.id] : ''}
                          onChange={(e) => sel && setCantidad(p.id, Number(e.target.value))}
                          style={{ width: 70, padding: '4px 6px', textAlign: 'right', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}
                          disabled={!sel}
                        />
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {provId ? (
                          <span>{provId.slice(0, 8)}…</span>
                        ) : (
                          <span className="meta">—</span>
                        )}
                      </td>
                      <td>
                        {sel && (
                          <button onClick={() => toggleProducto(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
                        )}
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
