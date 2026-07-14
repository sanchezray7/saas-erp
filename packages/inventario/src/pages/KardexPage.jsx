import { useEffect, useState, useCallback } from 'react'
import { useAuth, Button, Skeleton, alertError } from '@saas/core'
import { listarMovimientos } from '../data/inventario'
import { listarProductos } from '@saas/productos'

export function KardexPage() {
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroProd, setFiltroProd] = useState('')
  const [filtroLote, setFiltroLote] = useState('')
  const [expandido, setExpandido] = useState({})

  const load = useCallback(async () => {
    try {
      const [movs, prods] = await Promise.all([
        listarMovimientos(activeCompanyId),
        listarProductos(activeCompanyId),
      ])
      setData(movs)
      setProductos(prods)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  // Agrupar por producto + lote usando key única
  let grupoIdx = 0
  const grupos = {}
  data.forEach((m) => {
    if (filtroProd && m.producto_id !== filtroProd) return
    if (filtroLote && !(m.lote || '').toLowerCase().includes(filtroLote.toLowerCase())) return
    const key = (m.producto_id || 'sin_prod') + '|' + (m.lote || 'SIN LOTE')
    if (!grupos[key]) grupos[key] = { key: key + '_' + (++grupoIdx), producto: m.producto, lote: m.lote || 'SIN LOTE', movs: [] }
    grupos[key].movs.push(m)
  })

  // Ordenar grupos por producto
  const gruposList = Object.values(grupos).sort((a, b) => (a.producto?.nombre || '').localeCompare(b.producto?.nombre || ''))

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>📋 Kardex por Lote</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select className="form-input" value={filtroProd} onChange={(e) => setFiltroProd(e.target.value)} style={{ width: 200, fontSize: '0.82rem' }}>
          <option value="">Todos los productos</option>
          {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <input className="form-input" type="text" placeholder="Buscar lote..." value={filtroLote} onChange={(e) => setFiltroLote(e.target.value)} style={{ width: 160, fontSize: '0.82rem' }} />
      </div>

      {gruposList.length === 0 ? (
        <p className="meta" style={{ textAlign: 'center', padding: 24 }}>Sin movimientos con lote</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {gruposList.map((g) => {
            const open = expandido[g.key] !== false
            const saldoInicial = 0
            let saldo = saldoInicial
            return (
              <div key={g.key} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-soft)', cursor: 'pointer', fontSize: '0.85rem' }}
                  onClick={() => setExpandido((p) => ({ ...p, [g.key]: !open }))}
                >
                  <div>
                    <span style={{ fontWeight: 700 }}>{g.producto?.nombre || '—'}</span>
                    <span className="badge" style={{ marginLeft: 8, fontSize: '0.7rem', background: '#e0f2fe', color: '#0284c7' }}>Lote: {g.lote}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className="meta" style={{ fontSize: '0.72rem' }}>{g.movs.length} mov.</span>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{open ? '▲' : '▼'}</span>
                  </div>
                </div>
                {open && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ fontSize: '0.8rem', margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 100 }}>Fecha</th>
                          <th>Tipo</th>
                          <th style={{ textAlign: 'right' }}>Entrada</th>
                          <th style={{ textAlign: 'right' }}>Salida</th>
                          <th style={{ textAlign: 'right' }}>Saldo</th>
                          <th>Motivo</th>
                          <th>Almacén</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ fontWeight: 600, background: 'var(--bg-soft)' }}>
                          <td className="meta">—</td>
                          <td colSpan={3}>Saldo inicial</td>
                          <td style={{ textAlign: 'right' }}>0</td>
                          <td></td><td></td>
                        </tr>
                        {g.movs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map((m, i) => {
                          saldo += (m.tipo === 'entrada' ? Number(m.cantidad) : -Number(m.cantidad))
                          return (
                            <tr key={m.id}>
                              <td className="meta">{m.created_at?.slice(0, 10)}</td>
                              <td><span className="badge" style={{ fontSize: '0.7rem', background: m.tipo === 'entrada' ? '#dcfce7' : '#fef2f2', color: m.tipo === 'entrada' ? '#16a34a' : '#dc2626' }}>{m.tipo}</span></td>
                              <td style={{ textAlign: 'right', color: '#16a34a' }}>{m.tipo === 'entrada' ? Number(m.cantidad).toLocaleString() : ''}</td>
                              <td style={{ textAlign: 'right', color: '#dc2626' }}>{m.tipo === 'salida' ? Number(m.cantidad).toLocaleString() : ''}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{saldo.toLocaleString()}</td>
                              <td className="meta">{m.motivo || '—'}</td>
                              <td className="meta">{m.almacen?.nombre || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
