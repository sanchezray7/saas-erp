import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, ConfirmModal, formatMoney, alertError, notify } from '@saas/core'
import { listarFacturasProveedor, eliminarFacturaProveedor, actualizarEstadoFactura } from '../data/proveedorFacturas'

const BADGE_ESTADO = {
  pendiente: { bg: '#fef3c7', color: '#d97706' },
  conciliada: { bg: '#dcfce7', color: '#16a34a' },
  discrepancia: { bg: '#fef2f2', color: '#dc2626' },
  pagada: { bg: '#e0f2fe', color: '#0284c7' },
  anulada: { bg: '#f5f5f5', color: '#9ca3af' },
}

export function FacturasProveedorPage() {
  const { t } = useTranslation()
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await listarFacturasProveedor(activeCompanyId)
      setData(d)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    try {
      await eliminarFacturaProveedor(id)
      notify('Factura eliminada')
      setData((prev) => prev.filter((f) => f.id !== id))
    } catch (err) { alertError('Error', err.message) }
    setDeleting(null)
  }

  async function handleAnular(id) {
    if (!window.confirm('¿Anular esta factura?')) return
    try {
      await actualizarEstadoFactura(id, 'anulada')
      notify('Factura anulada')
      load()
    } catch (err) { alertError('Error', err.message) }
  }

  const filtered = data.filter((f) => {
    if (search) {
      const q = search.toLowerCase()
      if (!f.numero_factura?.toLowerCase().includes(q) && !f.proveedor?.nombre?.toLowerCase().includes(q)) return false
    }
    if (filtroEstado && f.estado !== filtroEstado) return false
    return true
  })

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>🧾 Facturas de proveedor</h1>
        <Link to="/facturas-proveedor/nueva"><Button size="sm">+ Nueva factura</Button></Link>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input type="search" placeholder="Buscar facturas..." className="form-input" style={{ width: '100%', maxWidth: 280 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="form-input" style={{ width: 160 }} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.keys(BADGE_ESTADO).map((est) => (
            <option key={est} value={est}>{est}</option>
          ))}
        </select>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>N° Factura</th>
            <th>Proveedor</th>
            <th>OC</th>
            <th>Emisión</th>
            <th>Vencimiento</th>
            <th>Total</th>
            <th>Estado</th>
            <th style={{ width: 130 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={8} className="meta" style={{ textAlign: 'center', padding: 32 }}>Sin datos</td></tr>
          ) : filtered.map((f) => {
            const badge = BADGE_ESTADO[f.estado] || BADGE_ESTADO.pendiente
            return (
              <tr key={f.id}>
                <td style={{ fontWeight: 600 }}><Link to={`/facturas-proveedor/${f.id}`} className="link">{f.numero_factura}</Link></td>
                <td>{f.proveedor?.nombre || '—'}</td>
                <td className="meta">{f.orden?.numero || '—'}</td>
                <td className="meta">{f.fecha_emision?.slice(0, 10)}</td>
                <td className="meta">{f.fecha_vencimiento?.slice(0, 10) || '—'}</td>
                <td style={{ fontWeight: 600 }}>{formatMoney(f.total, f.moneda)}</td>
                <td><span className="badge" style={{ background: badge.bg, color: badge.color }}>{f.estado}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Link to={`/facturas-proveedor/${f.id}`}><Button size="xs" variant="ghost">Ver</Button></Link>
                    {f.estado === 'pendiente' && (
                      <>
                        <Link to={`/facturas-proveedor/${f.id}/editar`}><Button size="xs" variant="ghost">Editar</Button></Link>
                        <Button size="xs" danger onClick={() => setDeleting(f.id)}>Eliminar</Button>
                      </>
                    )}
                    {f.estado === 'pendiente' && <Button size="xs" variant="ghost" onClick={() => handleAnular(f.id)}>Anular</Button>}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {deleting && (
        <ConfirmModal title="Eliminar factura" onConfirm={() => handleDelete(deleting)} onCancel={() => setDeleting(null)} />
      )}
    </div>
  )
}
