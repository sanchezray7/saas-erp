import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, ConfirmModal, alertError, notify, formatMoney, MONEDA_POR_PAIS } from '@saas/core'
import { listarCotizaciones, eliminarCotizacion } from '../data/cotizaciones'

const ESTADO_BADGE = {
  borrador: { bg: 'var(--bg-soft)', color: 'var(--text-muted)' },
  enviada: { bg: '#dbeafe', color: '#1d4ed8' },
  aceptada: { bg: '#dcfce7', color: '#16a34a' },
  rechazada: { bg: '#fce4ec', color: '#dc2626' },
  facturada: { bg: '#ede9fe', color: '#7c3aed' },
}
const IRREVERSIBLES = ['aceptada', 'rechazada', 'facturada']

export function CotizacionesPage() {
  const { t } = useTranslation()
  const { activeCompanyId, pais } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'USD'
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await listarCotizaciones(activeCompanyId)
      setCotizaciones(data)
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    try {
      await eliminarCotizacion(id)
      notify(t('common.eliminado'))
      setCotizaciones((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      alertError('Error', err.message)
    }
    setDeleting(null)
  }

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>📄 Cotizaciones</h1>
        <Link to="/cotizaciones/new"><Button size="sm">Nueva cotización</Button></Link>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Cliente</th>
            <th>Contacto</th>
            <th>Total</th>
            <th>Factura</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th style={{ width: 120 }}>{t('common.acciones')}</th>
          </tr>
        </thead>
        <tbody>
          {cotizaciones.length === 0 ? (
            <tr>
              <td colSpan={8} className="meta" style={{ textAlign: 'center', padding: 32 }}>
                {t('common.sinDatos')}
              </td>
            </tr>
          ) : cotizaciones.map((c) => {
            const badge = ESTADO_BADGE[c.estado] || ESTADO_BADGE.borrador
            return (
              <tr key={c.id}>
                <td data-label="N°" style={{ fontWeight: 600, fontSize: '0.82rem' }}>{c.numero}</td>
                <td data-label="Cliente">{c.contact?.name || '-'}</td>
                <td data-label="Contacto" className="meta">{c.contact?.email || c.contact?.phone || '-'}</td>
                <td data-label="Total" style={{ fontWeight: 600 }}>{formatMoney(c.total, c.moneda)}</td>
                <td data-label="Factura" style={{ fontSize: '0.78rem' }}>
                  {c.facturas?.length > 0 ? (
                    <span title={`CDC: ${c.facturas[0].cdc}`}>
                      {c.facturas[0].cdc?.slice(0, 12)}…
                    </span>
                  ) : (
                    <span className="meta">—</span>
                  )}
                </td>
                <td data-label="Estado">
                  <span className="badge" style={{ background: badge.bg, color: badge.color, fontSize: '0.7rem' }}>
                    {c.estado}
                  </span>
                </td>
                <td data-label="Fecha" className="meta">{c.created_at?.slice(0, 10)}</td>
                <td data-label="">
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Link to={`/cotizaciones/${c.id}`}><Button size="xs" variant="ghost">Ver</Button></Link>
                    {!IRREVERSIBLES.includes(c.estado) && (
                      <Link to={`/cotizaciones/${c.id}/edit`}><Button size="xs" variant="ghost">{t('common.editar')}</Button></Link>
                    )}
                    <Button size="xs" danger onClick={() => setDeleting(c.id)}>{t('common.eliminar')}</Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {deleting && (
        <ConfirmModal
          title="Eliminar cotización"
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
