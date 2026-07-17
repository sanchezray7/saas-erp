import { useEffect, useState, useCallback } from 'react'
import { useAuth, Skeleton } from '@saas/core'
import { listarCierres } from '../data/pos'

export function CierresPage() {
  const { activeCompanyId } = useAuth()
  const [cierres, setCierres] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try { setCierres(await listarCierres(activeCompanyId)) }
    catch {}
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>📊 Cierres de caja</h1>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Caja</th>
            <th>Apertura</th>
            <th>Cierre</th>
            <th>Ventas</th>
            <th>Total ventas</th>
            <th>Saldo inicial</th>
            <th>Saldo esperado</th>
            <th>Saldo real</th>
            <th>Diferencia</th>
            <th>Obs.</th>
          </tr>
        </thead>
        <tbody>
          {cierres.map((c) => (
            <tr key={c.id}>
              <td style={{ fontWeight: 600 }}>{c.caja?.nombre || '—'}</td>
              <td className="meta">{new Date(c.apertura_en).toLocaleString('es-PY')}</td>
              <td className="meta">{new Date(c.cierre_en).toLocaleString('es-PY')}</td>
              <td style={{ textAlign: 'right' }}>{c.ventas_count}</td>
              <td style={{ textAlign: 'right' }}>{Number(c.ventas_total).toLocaleString()}</td>
              <td style={{ textAlign: 'right' }}>{Number(c.saldo_inicial).toLocaleString()}</td>
              <td style={{ textAlign: 'right' }}>{Number(c.saldo_esperado).toLocaleString()}</td>
              <td style={{ textAlign: 'right' }}>{Number(c.saldo_real).toLocaleString()}</td>
              <td style={{ textAlign: 'right', color: c.dif_esperada !== 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                {c.dif_esperada > 0 ? '+' : ''}{Number(c.dif_esperada).toLocaleString()}
              </td>
              <td className="meta">{c.observaciones || '—'}</td>
            </tr>
          ))}
          {cierres.length === 0 && <tr><td colSpan={10} className="meta" style={{ textAlign: 'center', padding: 24 }}>No hay cierres registrados</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
