import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, alertError } from '@saas/core'
import { listarNotas } from '../data/notasCD'

const BADGE = {
  borrador: { bg: '#f5f5f5', color: '#6b7280' },
  emitida: { bg: '#e0f2fe', color: '#0284c7' },
  aprobada: { bg: '#dcfce7', color: '#16a34a' },
  rechazada: { bg: '#fef2f2', color: '#dc2626' },
  cancelada: { bg: '#f5f5f5', color: '#9ca3af' },
}

export function NotasCDPage() {
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    listarNotas(activeCompanyId).then(setData).catch((err) => alertError('Error', err.message)).finally(() => setLoading(false))
  }, [activeCompanyId])

  if (loading) return <Skeleton.Card />

  const filtradas = filtro ? data.filter((n) => n.tipo === filtro) : data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📝 Notas de Crédito / Débito</h1>
          <Link to="/notas-cd/nueva"><Button size="sm">+ Nueva nota</Button></Link>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {['', 'credito', 'debito'].map((t) => (
            <button key={t} onClick={() => setFiltro(t)} style={{
              padding: '4px 14px', borderRadius: 6, border: filtro === t ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
              background: filtro === t ? 'var(--color-accent)' : 'transparent',
              color: filtro === t ? '#fff' : 'var(--color-text)', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem',
            }}>
              {t === '' ? 'Todas' : t === 'credito' ? '🧾 Crédito' : '📈 Débito'}
            </button>
          ))}
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="card"><p className="meta" style={{ textAlign: 'center', padding: 24 }}>No hay notas emitidas</p></div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Tipo</th>
                  <th>Factura origen</th>
                  <th>Motivo</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((n) => {
                  const badge = BADGE[n.estado] || BADGE.borrador
                  return (
                    <tr key={n.id}>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{n.numero || n.id.slice(0, 8)}</td>
                      <td>
                        <span className="badge" style={{ background: n.tipo === 'credito' ? '#dcfce7' : '#fef3c7', color: n.tipo === 'credito' ? '#16a34a' : '#d97706' }}>
                          {n.tipo === 'credito' ? '🧾 NC' : '📈 ND'}
                        </span>
                      </td>
                      <td className="meta">{n.factura_origen?.numero || '—'}</td>
                      <td className="meta" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.motivo}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(n.total, n.moneda)}</td>
                      <td>
                        <span className="badge" style={{ background: badge.bg, color: badge.color }}>{n.estado}</span>
                      </td>
                      <td className="meta">{n.created_at?.slice(0, 10)}</td>
                      <td>
                        <Link to={`/notas-cd/${n.id}`} className="link" style={{ fontSize: '0.82rem' }}>Ver</Link>
                      </td>
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
