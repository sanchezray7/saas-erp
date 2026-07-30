import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, alertError, notify } from '@saas/core'
import { obtenerSugerencias, generarOCs, optimizarConIA } from '../data/sugerenciasOC'

export function SugerenciasOCPage() {
  const { activeCompanyId } = useAuth()
  const navigate = useNavigate()
  const [productos, setProductos] = useState([])
  const [asignaciones, setAsignaciones] = useState({})
  const [cantidades, setCantidades] = useState({})
  const [justificaciones, setJustificaciones] = useState({})
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [optimizando, setOptimizando] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await obtenerSugerencias(activeCompanyId)
      setProductos(d)
      const asig = {}
      const cant = {}
      for (const p of d) {
        const mejor = p.proveedores?.[0]
        asig[p.producto_id] = mejor?.proveedor_id || ''
        const faltante = Math.max(0, Number(p.stock_minimo) - Number(p.stock_total))
        cant[p.producto_id] = Math.max(faltante, Number(p.stock_minimo))
      }
      setAsignaciones(asig)
      setCantidades(cant)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  function proveedorNombre(producto) {
    const provId = asignaciones[producto.producto_id]
    return producto.proveedores?.find((p) => p.proveedor_id === provId)?.proveedor_nombre || '—'
  }

  function precioUnitario(producto) {
    const provId = asignaciones[producto.producto_id]
    return producto.proveedores?.find((p) => p.proveedor_id === provId)?.precio || 0
  }

  const grupos = {}
  for (const p of productos) {
    const provId = asignaciones[p.producto_id]
    if (!provId) continue
    if (!grupos[provId]) {
      const prov = p.proveedores?.find((pr) => pr.proveedor_id === provId)
      grupos[provId] = { proveedor_id: provId, proveedor_nombre: prov?.proveedor_nombre || '—', moneda: prov?.moneda || 'PYG', items: [] }
    }
    grupos[provId].items.push(p)
  }

  const gruposArray = Object.values(grupos)

  async function handleGenerar() {
    setGenerando(true)
    try {
      const creadas = await generarOCs(activeCompanyId, productos, asignaciones)
      notify(`${creadas.length} OC(s) generada(s): ${creadas.map((c) => c.numero).join(', ')}`)
      if (creadas.length === 1) {
        navigate(`/ordenes-compra/${creadas[0].id}`)
      } else {
        navigate('/ordenes-compra')
      }
    } catch (err) { alertError('Error al generar OCs', err.message) }
    finally { setGenerando(false) }
  }

  async function handleOptimizarIA() {
    setOptimizando(true)
    try {
      const result = await optimizarConIA(activeCompanyId, productos)
      const sug = result?.sugerencias || []
      if (sug.length === 0) { notify('⚠️ La IA no generó sugerencias'); return }

      const nuevasAsig = { ...asignaciones }
      const nuevasCant = { ...cantidades }
      const nuevasJust = { ...justificaciones }

      // Mapear sugerencias por nombre (la IA puede devolver IDs incorrectos)
      for (const s of sug) {
        const match = productos.find((p) =>
          p.producto_nombre === s.producto_nombre ||
          p.producto_codigo === s.producto_id ||
          p.producto_id === s.producto_id
        )
        if (!match || !s.proveedor_id) continue

        // Buscar proveedor por nombre (la IA puede devolver nombre en vez de UUID)
        const provMatch = match.proveedores?.find((pr) =>
          pr.proveedor_id === s.proveedor_id || pr.proveedor_nombre === s.proveedor_id
        )
        if (!provMatch) continue

        nuevasAsig[match.producto_id] = provMatch.proveedor_id
        if (s.cantidad > 0) nuevasCant[match.producto_id] = s.cantidad
        nuevasJust[match.producto_id] = s.justificacion || s.justificación || s.razon || s.motivo || 'Optimizado por IA'
      }

      setAsignaciones(nuevasAsig)
      setCantidades(nuevasCant)
      setJustificaciones(nuevasJust)
      notify(`🤖 IA optimizó ${Object.keys(nuevasJust).length} producto(s)`)
    } catch (err) { alertError('Error al optimizar con IA', err.message) }
    finally { setOptimizando(false) }
  }

  const sinProveedor = productos.filter((p) => !asignaciones[p.producto_id] || (p.proveedores?.length || 0) === 0)
  const justCount = Object.keys(justificaciones).length

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <div>
            <h1>🤖 Sugerencias de compra</h1>
            <p className="meta">
              {productos.length} producto(s) con stock bajo el mínimo
              {gruposArray.length > 0 && ` — ${gruposArray.length} OC(s) sugerida(s)`}
              {justCount > 0 && ` · 🤖 ${justCount} optimizado(s)`}
            </p>
          </div>
          {gruposArray.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={handleOptimizarIA} disabled={optimizando} variant="ghost">
                {optimizando ? 'Optimizando...' : '🤖 Optimizar con IA'}
              </Button>
              <Button onClick={handleGenerar} disabled={generando}>
                {generando ? 'Generando...' : `📋 Crear ${gruposArray.length} OC(s)`}
              </Button>
            </div>
          )}
        </div>
      </div>

      {productos.length === 0 && (
        <div className="card">
          <p className="meta" style={{ textAlign: 'center', padding: 24 }}>
            No hay productos con stock bajo el mínimo. Revisá el stock mínimo en el catálogo de productos.
          </p>
        </div>
      )}

      {sinProveedor.length > 0 && (
        <div className="card" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 8px', color: '#dc2626' }}>
            ⚠️ {sinProveedor.length} producto(s) sin proveedor asignado
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {sinProveedor.map((p) => (
              <Link key={p.producto_id} to="/proveedores" className="link" style={{ fontSize: '0.82rem' }}>
                {p.producto_nombre}
              </Link>
            ))}
          </div>
          <p className="meta" style={{ marginTop: 8, fontSize: '0.78rem' }}>
            Asigná proveedores desde la ficha del proveedor (sección &quot;Productos que provee&quot;).
          </p>
        </div>
      )}

      {gruposArray.map((grupo) => {
        const total = grupo.items.reduce((s, i) => {
          const cant = Number(cantidades[i.producto_id]) || 0
          const precio = Number(precioUnitario(i))
          return s + cant * precio
        }, 0)
        return (
          <div key={grupo.proveedor_id} className="card">
            <div className="page-header" style={{ marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                  🏭 {grupo.proveedor_nombre}
                </h3>
                <p className="meta">{grupo.items.length} producto(s) · Total sugerido: {formatMoney(total, grupo.moneda)}</p>
              </div>
              <Link to={`/ordenes-compra/nueva?proveedor=${grupo.proveedor_id}`} className="link" style={{ fontSize: '0.82rem' }}>
                Crear OC manual →
              </Link>
            </div>
            <div className="table-wrapper">
              <table className="table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{ textAlign: 'center' }}>Stock</th>
                    <th style={{ textAlign: 'center' }}>Mínimo</th>
                    <th style={{ textAlign: 'right' }}>Cant. sugerida</th>
                    <th>Proveedor</th>
                    <th style={{ textAlign: 'right' }}>Precio</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.items.map((p) => {
                    const cant = Number(cantidades[p.producto_id]) || 0
                    const precio = Number(precioUnitario(p))
                    return (
                      <tr key={p.producto_id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {p.producto_nombre}
                            {Object.prototype.hasOwnProperty.call(justificaciones, p.producto_id) && (
                              <span title={justificaciones[p.producto_id] || 'Optimizado por IA'} style={{ cursor: 'help', marginLeft: 6, fontSize: '0.72rem', color: '#16a34a' }}>🤖</span>
                            )}
                          </div>
                          <div className="meta">{p.producto_codigo || ''}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>{Math.round(Number(p.stock_total))}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>{Math.round(Number(p.stock_minimo))}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            className="form-input"
                            type="number"
                            min="1"
                            value={cant}
                            onChange={(e) => setCantidades((prev) => ({ ...prev, [p.producto_id]: Number(e.target.value) }))}
                            style={{ width: 80, padding: '4px 8px', fontSize: '0.85rem', textAlign: 'right' }}
                          />
                        </td>
                        <td>
                          {p.proveedores?.length > 1 ? (
                            <select
                              className="form-input"
                              value={asignaciones[p.producto_id] || ''}
                              onChange={(e) => setAsignaciones((prev) => ({ ...prev, [p.producto_id]: e.target.value }))}
                              style={{ fontSize: '0.82rem', padding: '4px 6px' }}
                            >
                              {p.proveedores.map((pr) => (
                                <option key={pr.proveedor_id} value={pr.proveedor_id}>
                                  {pr.proveedor_nombre} ({formatMoney(pr.precio, pr.moneda)})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ fontSize: '0.82rem' }}>{grupo.proveedor_nombre}</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatMoney(precio, grupo.moneda)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatMoney(cant * precio, grupo.moneda)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
