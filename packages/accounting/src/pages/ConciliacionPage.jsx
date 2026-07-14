import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, alertError } from '@saas/core'
import { listarConciliaciones } from '../data/conciliacion'

export function ConciliacionPage() {
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listarConciliaciones(activeCompanyId).then(setData).catch((err) => alertError('Error', err.message)).finally(() => setLoading(false))
  }, [activeCompanyId])

  if (loading) return <Skeleton.Card />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>🏦 Conciliación bancaria</h1>
          <Link to="/conciliacion/nueva"><Button size="sm">+ Nueva conciliación</Button></Link>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="card"><p className="meta" style={{ textAlign: 'center', padding: 24 }}>No hay conciliaciones. Creá una desde una cuenta bancaria.</p></div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Período</th>
                  <th>Saldo extracto</th>
                  <th>Saldo libro</th>
                  <th>Diferencia</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => {
                  const dif = Number(c.saldo_final_extracto) - Number(c.saldo_final_libro)
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>
                        {c.account?.banco_nombre || c.account?.name || '—'}
                        <div className="meta">{c.account?.numero_cuenta || ''}</div>
                      </td>
                      <td className="meta">{c.periodo_inicio?.slice(0, 10)} — {c.periodo_fin?.slice(0, 10)}</td>
                      <td style={{ fontWeight: 600 }}>{Number(c.saldo_final_extracto).toLocaleString()}</td>
                      <td style={{ fontWeight: 600 }}>{Number(c.saldo_final_libro).toLocaleString()}</td>
                      <td style={{ fontWeight: 700, color: dif === 0 ? '#16a34a' : '#dc2626' }}>{dif.toLocaleString()}</td>
                      <td>
                        <span className="badge" style={{ background: c.estado === 'cerrada' ? '#dcfce7' : c.estado === 'conciliada' ? '#e0f2fe' : '#fef3c7', color: c.estado === 'cerrada' ? '#16a34a' : c.estado === 'conciliada' ? '#0284c7' : '#d97706' }}>
                          {c.estado}
                        </span>
                      </td>
                      <td><Link to={`/conciliacion/${c.id}`} className="link" style={{ fontSize: '0.82rem' }}>Ver</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
