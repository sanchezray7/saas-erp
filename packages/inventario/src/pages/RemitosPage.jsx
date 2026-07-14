import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, alertError } from '@saas/core'
import { listarRemitos } from '../data/remitos'

export function RemitosPage() {
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try { setData(await listarRemitos(activeCompanyId)) } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])
  useEffect(() => { load() }, [load])

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>📄 Remitos</h1>
      </div>
      {data.length === 0 ? (
        <p className="meta" style={{ textAlign: 'center', padding: 24 }}>Sin remitos generados</p>
      ) : (
        <table className="table" style={{ fontSize: '0.82rem' }}>
          <thead><tr><th>N° Remito</th><th>Fecha</th><th>Transportista</th><th style={{ width: 80 }}></th></tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8rem' }}>{r.numero}</td>
                <td className="meta">{r.fecha?.slice(0, 10)}</td>
                <td>{r.transportista?.nombre || '—'}</td>
                <td><Link to={`/remitos/${r.id}`}><Button size="xs" variant="ghost">Ver</Button></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
