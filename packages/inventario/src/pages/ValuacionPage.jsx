import { useEffect, useState, useCallback } from 'react'
import { useAuth, Skeleton, formatMoney, alertError } from '@saas/core'
import { obtenerValuacion } from '../data/inventario'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export function ValuacionPage() {
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await obtenerValuacion(activeCompanyId)
      setData(d)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  if (loading) return <Skeleton.Card />

  const chartData = (data?.almacenes || []).map((a) => ({ nombre: a.nombre || 'Sin almacén', valor: a.subTotal }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>💰 Valuación de inventario</h1>
          <p className="meta">
            {data?.totalAlmacenes || 0} almacenes · {data?.granProductos || 0} productos
          </p>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div className="meta" style={{ fontSize: '0.75rem' }}>Valor total del stock</div>
            <div style={{ fontWeight: 700, fontSize: '1.4rem', color: 'var(--color-accent)' }}>
              {formatMoney(data?.granTotal || 0)}
            </div>
          </div>
          <div>
            <div className="meta" style={{ fontSize: '0.75rem' }}>Productos en stock</div>
            <div style={{ fontWeight: 700, fontSize: '1.4rem' }}>{data?.granProductos || 0}</div>
          </div>
          <div>
            <div className="meta" style={{ fontSize: '0.75rem' }}>Almacenes</div>
            <div style={{ fontWeight: 700, fontSize: '1.4rem' }}>{data?.totalAlmacenes || 0}</div>
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16 }}>Valor por almacén</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="nombre" tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" tickFormatter={(v) => formatMoney(v).slice(0, 10)} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.82rem' }}
                formatter={(value) => [formatMoney(value), 'Valor']}
              />
              <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {(data?.almacenes || []).length === 0 && (
        <div className="card">
          <p className="meta" style={{ textAlign: 'center', padding: 24 }}>
            No hay stock registrado. Ingresá productos a través de compras o movimientos de stock.
          </p>
        </div>
      )}

      {(data?.almacenes || []).map((alm) => (
        <div key={alm.id} className="card">
          <div
            className="page-header"
            style={{ cursor: 'pointer', marginBottom: expanded === alm.id ? 12 : 0 }}
            onClick={() => setExpanded(expanded === alm.id ? null : alm.id)}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{alm.nombre}</span>
                <span className="badge" style={{ background: '#e5e7eb', color: '#374151', fontSize: '0.72rem' }}>{alm.tipo}</span>
                {alm.centro && <span className="meta" style={{ fontSize: '0.75rem' }}>{alm.centro.nombre}</span>}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <span className="meta" style={{ fontSize: '0.78rem' }}>{alm.subProductos} productos</span>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{formatMoney(alm.subTotal)}</span>
              </div>
            </div>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{expanded === alm.id ? '▲' : '▼'}</span>
          </div>

          {expanded === alm.id && (
            <div className="table-wrapper">
              <table className="table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{ textAlign: 'right' }}>Cantidad</th>
                    <th style={{ textAlign: 'right' }}>Costo prom.</th>
                    <th style={{ textAlign: 'right' }}>Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {alm.items
                    .sort((a, b) => b.valor - a.valor)
                    .map((item) => (
                      <tr key={item.producto_id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.nombre}</div>
                          <div className="meta">{item.codigo} {item.unidad_medida && `· ${item.unidad_medida}`}</div>
                        </td>
                        <td style={{ textAlign: 'right' }}>{Number(item.cantidad).toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}>{formatMoney(item.costo_promedio)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(item.valor)}</td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ fontWeight: 700 }}>Total {alm.nombre}</td>
                    <td></td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem' }}>{formatMoney(alm.subTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
