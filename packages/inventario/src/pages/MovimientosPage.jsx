import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, alertError } from '@saas/core'
import { listarMovimientos, listarStockGeneral } from '../data/inventario'

export function MovimientosPage() {
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [productos, setProductos] = useState([])
  const [filtroProd, setFiltroProd] = useState('')

  const load = useCallback(async () => {
    try {
      const [movs, stock] = await Promise.all([
        listarMovimientos(activeCompanyId),
        listarStockGeneral(activeCompanyId),
      ])
      setData(movs)
      const prodMap = {}
      stock.forEach((s) => { if (s.producto) prodMap[s.producto_id] = s.producto })
      setProductos(Object.values(prodMap))
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  const filtered = data.filter((m) => !filtroProd || m.producto_id === filtroProd)

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>📋 Movimientos de Stock</h1>
        <Link to="/inventario"><Button variant="ghost" size="sm">Volver</Button></Link>
      </div>

      <div style={{ marginBottom: 12 }}>
        <select className="form-input" value={filtroProd} onChange={(e) => setFiltroProd(e.target.value)} style={{ maxWidth: 300 }}>
          <option value="">Todos los productos</option>
          {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="meta" style={{ textAlign: 'center', padding: 24 }}>Sin movimientos</p>
      ) : (
        <table className="table" style={{ fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Tipo</th>
              <th style={{ textAlign: 'right' }}>Cantidad</th>
              <th>Almacén</th>
              <th>Lote</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id}>
                <td className="meta">{m.created_at?.slice(0, 16).replace('T', ' ')}</td>
                <td style={{ fontWeight: 600 }}>{m.producto?.nombre || '—'}</td>
                <td><span className="badge" style={{
                  background: m.tipo === 'entrada' ? '#dcfce7' : m.tipo === 'salida' ? '#fef2f2' : '#fef3c7',
                  color: m.tipo === 'entrada' ? '#16a34a' : m.tipo === 'salida' ? '#dc2626' : '#d97706',
                }}>{m.tipo}</span></td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: m.tipo === 'entrada' ? '#16a34a' : '#dc2626' }}>
                  {m.tipo === 'entrada' ? '+' : '-'}{Number(m.cantidad).toLocaleString()}
                </td>
                <td className="meta">{m.almacen?.nombre || '—'}</td>
                <td className="meta">{m.lote || '—'}</td>
                <td className="meta">{m.motivo || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
