import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, ConfirmModal, alertError, notify, formatMoney, getSupabase } from '@saas/core'
import { listarOrdenes } from '../data/ordenesCompra'

const ESTADO_BADGE = {
  borrador: { bg: 'var(--bg-soft)', color: 'var(--text-muted)' },
  enviada: { bg: '#dbeafe', color: '#1d4ed8' },
  confirmada: { bg: '#dcfce7', color: '#16a34a' },
  recibida: { bg: '#ede9fe', color: '#7c3aed' },
  cancelada: { bg: '#fce4ec', color: '#dc2626' },
}

export function OrdenesCompraPage() {
  const { t } = useTranslation()
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await listarOrdenes(activeCompanyId)
      setData(d)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    try {
      const supabase = getSupabase()
      await supabase.from('ordenes_compra').delete().eq('id', id)
      notify('Orden eliminada')
      setData((prev) => prev.filter((o) => o.id !== id))
    } catch (err) { alertError('Error', err.message) }
    setDeleting(null)
  }

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>📋 Órdenes de compra</h1>
        <Link to="/ordenes-compra/nueva"><Button size="sm">+ Nueva orden</Button></Link>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Proveedor</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th style={{ width: 120 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={6} className="meta" style={{ textAlign: 'center', padding: 32 }}>Sin datos</td></tr>
          ) : data.map((o) => {
            const badge = ESTADO_BADGE[o.estado] || ESTADO_BADGE.borrador
            return (
              <tr key={o.id}>
                <td style={{ fontWeight: 600 }}>{o.numero}</td>
                <td>{o.proveedor?.nombre || '—'}</td>
                <td style={{ fontWeight: 600 }}>{formatMoney(o.total, o.moneda)}</td>
                <td><span className="badge" style={{ background: badge.bg, color: badge.color }}>{o.estado}</span></td>
                <td className="meta">{o.created_at?.slice(0, 10)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Link to={`/ordenes-compra/${o.id}`}><Button size="xs" variant="ghost">Ver</Button></Link>
                    {o.estado === 'borrador' && <Button size="xs" danger onClick={() => setDeleting(o.id)}>Eliminar</Button>}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {deleting && (
        <ConfirmModal title="Eliminar orden" onConfirm={() => handleDelete(deleting)} onCancel={() => setDeleting(null)} />
      )}
    </div>
  )
}
