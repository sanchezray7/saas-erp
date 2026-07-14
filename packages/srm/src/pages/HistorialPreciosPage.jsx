import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, alertError } from '@saas/core'
import { productosConHistorial, historialPreciosProducto } from '../data/historialPrecios'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export function HistorialPreciosPage() {
  const { activeCompanyId } = useAuth()
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [historial, setHistorial] = useState(null)
  const [histLoading, setHistLoading] = useState(false)

  const loadProductos = useCallback(async () => {
    try {
      const d = await productosConHistorial(activeCompanyId)
      setProductos(d)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { loadProductos() }, [loadProductos])

  useEffect(() => {
    if (!selectedId) { setHistorial(null); return }
    setHistLoading(true)
    historialPreciosProducto(activeCompanyId, selectedId)
      .then(setHistorial)
      .catch((err) => alertError('Error', err.message))
      .finally(() => setHistLoading(false))
  }, [selectedId, activeCompanyId])

  const productoActual = productos.find((p) => p.producto_id === selectedId)

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📈 Historial de precios</h1>
        </div>

        <div style={{ marginBottom: 16 }}>
          <select className="form-input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ width: '100%', maxWidth: 400 }}>
            <option value="">— Seleccionar producto —</option>
            {productos.map((p) => (
              <option key={p.producto_id} value={p.producto_id}>
                {p.producto_nombre} ({p.producto_codigo || 'sin código'}) — {p.total_ocs} OCs
              </option>
            ))}
          </select>
        </div>

        {productos.length === 0 && (
          <p className="meta" style={{ textAlign: 'center', padding: 24 }}>
            No hay productos con historial de compras. Las OC deben estar en estado "confirmada" o "recibida".
          </p>
        )}
      </div>

      {selectedId && (
        <>
          {/* Resumen */}
          {productoActual && (
            <div className="card" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div className="meta" style={{ fontSize: '0.75rem' }}>Producto</div>
                <div style={{ fontWeight: 700 }}>{productoActual.producto_nombre}</div>
                <div className="meta">{productoActual.producto_codigo || ''}</div>
              </div>
              <div>
                <div className="meta" style={{ fontSize: '0.75rem' }}>Precio actual</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatMoney(productoActual.precio_actual, productoActual.moneda)}</div>
              </div>
              <div>
                <div className="meta" style={{ fontSize: '0.75rem' }}>Último OC</div>
                <div style={{ fontWeight: 700 }}>{formatMoney(productoActual.ultimo_precio, productoActual.moneda)}</div>
              </div>
              <div>
                <div className="meta" style={{ fontSize: '0.75rem' }}>Total OCs</div>
                <div style={{ fontWeight: 700 }}>{productoActual.total_ocs}</div>
              </div>
            </div>
          )}

          {/* Gráfico */}
          <div className="card">
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16 }}>Evolución del precio</h3>
            {histLoading ? (
              <div className="skeleton" style={{ width: '100%', height: 300 }} />
            ) : historial && historial.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historial} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11 }} tickFormatter={(v) => v?.slice(0, 10)} stroke="var(--color-text-muted)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.82rem' }}
                    labelFormatter={(v) => `Fecha: ${v?.slice(0, 10)}`}
                    formatter={(value, name) => {
                      if (name === 'precio') return [formatMoney(value, historial[0]?.moneda), 'Precio']
                      return [value, name]
                    }}
                  />
                  <Line type="monotone" dataKey="precio" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="meta" style={{ textAlign: 'center', padding: 24 }}>Sin datos históricos</p>
            )}
          </div>

          {/* Tabla */}
          <div className="card">
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>Detalle de compras</h3>
            {!historial || historial.length === 0 ? (
              <p className="meta" style={{ textAlign: 'center', padding: 16 }}>Sin datos</p>
            ) : (
              <table className="table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>OC</th>
                    <th>Proveedor</th>
                    <th style={{ textAlign: 'right' }}>Cantidad</th>
                    <th style={{ textAlign: 'right' }}>Precio</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h, i) => (
                    <tr key={i}>
                      <td className="meta">{h.fecha?.slice(0, 10)}</td>
                      <td style={{ fontWeight: 600 }}>
                        <Link to={`/ordenes-compra/${h.oc_id}`} className="link">{h.oc_numero}</Link>
                      </td>
                      <td>
                        <Link to={`/proveedores/${h.proveedor_id}`} className="link">{h.proveedor_nombre}</Link>
                      </td>
                      <td style={{ textAlign: 'right' }}>{Number(h.cantidad).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(h.precio, h.moneda)}</td>
                      <td style={{ textAlign: 'right' }}>{formatMoney(h.subtotal, h.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
