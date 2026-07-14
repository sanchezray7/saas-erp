import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, alertError } from '@saas/core'
import { listarPicking } from '../data/picking'

const BADGE = {
  pendiente: { bg: '#fef3c7', color: '#d97706' },
  preparando: { bg: '#e0f2fe', color: '#0284c7' },
  preparado: { bg: '#dcfce7', color: '#16a34a' },
  despachado: { bg: '#f5f5f5', color: '#9ca3af' },
}

export function PickingPage() {
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try { setData(await listarPicking(activeCompanyId)) } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])
  useEffect(() => { load() }, [load])

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>📋 Órdenes de picking</h1>
      </div>
      {data.length === 0 ? (
        <p className="meta" style={{ textAlign: 'center', padding: 24 }}>Sin órdenes de picking. Se generan automáticamente al facturar una venta.</p>
      ) : (
        <table className="table" style={{ fontSize: '0.82rem' }}>
          <thead><tr><th>N°</th><th>Factura</th><th>Fecha</th><th>Estado</th><th style={{ width: 80 }}></th></tr></thead>
          <tbody>
            {data.map((p) => {
              const badge = BADGE[p.estado] || BADGE.pendiente
              return (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8rem' }}>{p.numero}</td>
                  <td className="meta">{p.factura?.numero || '—'}</td>
                  <td className="meta">{p.created_at?.slice(0, 10)}</td>
                  <td><span className="badge" style={{ background: badge.bg, color: badge.color }}>{p.estado}</span></td>
                  <td><Link to={`/picking/${p.id}`}><Button size="xs" variant="ghost">Ver</Button></Link></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
