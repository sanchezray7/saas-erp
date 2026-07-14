import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, alertError } from '@saas/core'
import { listarAsientos } from '../data/asientos'

const BADGE_ESTADO = {
  borrador: { bg: '#fef3c7', color: '#d97706' },
  contabilizado: { bg: '#dcfce7', color: '#16a34a' },
  anulado: { bg: '#f5f5f5', color: '#9ca3af' },
}

const TIPO_LABEL = {
  factura_proveedor: 'Factura Proveedor',
  factura_cliente: 'Factura Cliente',
  pago_proveedor: 'Pago Proveedor',
  pago_cliente: 'Pago Cliente',
  manual: 'Manual',
}

export function AsientosPage() {
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const d = await listarAsientos(activeCompanyId)
      setData(d)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>📒 Asientos Contables</h1>
        <Link to="/asientos/nuevo"><Button size="sm">+ Nuevo asiento</Button></Link>
      </div>

      {data.length === 0 ? (
        <p className="meta" style={{ textAlign: 'center', padding: 32 }}>
          Sin asientos. Se generan automáticamente al conciliar facturas de proveedor.
        </p>
      ) : (
        <table className="table" style={{ fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th>N° Asiento</th>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Tipo</th>
              <th style={{ textAlign: 'right' }}>Débito</th>
              <th style={{ textAlign: 'right' }}>Crédito</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.map((e) => {
              const badge = BADGE_ESTADO[e.estado] || BADGE_ESTADO.borrador
              return (
                <tr key={e.id}>
                  <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                    <Link to={`/asientos/${e.id}`} className="link">{e.entry_number}</Link>
                  </td>
                  <td className="meta">{e.entry_date?.slice(0, 10)}</td>
                  <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</td>
                  <td><span className="badge">{TIPO_LABEL[e.source_type] || e.source_type}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(e.total_debit, 'PYG')}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(e.total_credit, 'PYG')}</td>
                  <td><span className="badge" style={{ background: badge.bg, color: badge.color }}>{e.estado}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
