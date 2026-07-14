import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, alertError, notify } from '@saas/core'
import { obtenerPicking, actualizarItemPicking, cambiarEstadoPicking } from '../data/picking'
import { listarAlmacenes } from '../data/inventario'
import { listarTransportistas } from '../data/transportistas'
import { generarRemito } from '../data/remitos'
import { registrarMovimientoStock } from '@saas/inventario'

export function PickingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeCompanyId, user } = useAuth()
  const [picking, setPicking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [showDespachar, setShowDespachar] = useState(false)
  const [transportistas, setTransportistas] = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [envio, setEnvio] = useState({ transportista_id: '', almacen_id: '', chofer: '', patente: '', destino: '' })

  useEffect(() => {
    obtenerPicking(id).then(setPicking).catch(() => {}).finally(() => setLoading(false))
    Promise.all([listarTransportistas(activeCompanyId), listarAlmacenes(activeCompanyId)])
      .then(([t, a]) => { setTransportistas(t); setAlmacenes(a) }).catch(() => {})
  }, [id, activeCompanyId])

  async function handleUpdateItem(itemId, value) {
    setGuardando(true)
    try { await actualizarItemPicking(itemId, value); setPicking(await obtenerPicking(id)) }
    catch (err) { alertError('Error', err.message) }
    finally { setGuardando(false) }
  }

  async function handleCambiarEstado(estado) {
    try { await cambiarEstadoPicking(id, estado); setPicking(await obtenerPicking(id)); notify(`Estado: ${estado}`) }
    catch (err) { alertError('Error', err.message) }
  }

  async function handleDespachar() {
    if (!envio.transportista_id) { alertError('Error', 'Seleccioná un transportista'); return }
    if (!envio.almacen_id) { alertError('Error', 'Seleccioná un almacén'); return }
    try {
      // Generar remito
      const remito = await generarRemito(activeCompanyId, id, picking.factura_id, envio)
      // Registrar salida de stock por cada item
      for (const item of picking.items || []) {
        if (Number(item.cantidad_preparada) <= 0) continue
        await registrarMovimientoStock(activeCompanyId, user?.id, {
          producto_id: item.producto_id, almacen_id: envio.almacen_id, tipo: 'salida',
          cantidad: Number(item.cantidad_preparada),
          motivo: 'Despacho ' + picking.numero, referencia_type: 'ajuste',
        })
      }
      await cambiarEstadoPicking(id, 'despachado')
      notify('Pedido despachado. Remito ' + remito.numero)
      setShowDespachar(false)
      setPicking(await obtenerPicking(id))
      navigate(`/remitos/${remito.id}`)
    } catch (err) { alertError('Error', err.message) }
  }

  if (loading) return <Skeleton.Card />
  if (!picking) return <div className="card"><p className="meta">No encontrado</p></div>

  const items = picking.items || []
  const todoListo = items.every((i) => Number(i.cantidad_preparada) >= Number(i.cantidad_solicitada))
  const hayProgreso = items.some((i) => Number(i.cantidad_preparada) > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1rem', margin: 0, fontFamily: 'monospace' }}>{picking.numero}</h1>
            <p className="meta">Factura: {picking.factura?.numero || '—'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {picking.estado === 'pendiente' && <Button size="sm" onClick={() => handleCambiarEstado('preparando')}>▶ Iniciar preparación</Button>}
            {picking.estado === 'preparado' && <Button size="sm" onClick={() => setShowDespachar(true)}>📦 Despachar</Button>}
            <Link to="/picking"><Button variant="ghost" size="sm">Volver</Button></Link>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <span className="badge" style={{ fontSize: '0.82rem', padding: '4px 12px', background: picking.estado === 'despachado' ? '#f5f5f5' : '#dcfce7', color: picking.estado === 'despachado' ? '#9ca3af' : '#16a34a' }}>{picking.estado}</span>
          {todoListo && picking.estado !== 'despachado' && (
            <Button size="xs" onClick={() => handleCambiarEstado('preparado')}>✅ Marcar preparado</Button>
          )}
        </div>

        <table className="table" style={{ fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th>Producto</th>
              <th style={{ textAlign: 'right' }}>Solicitado</th>
              <th style={{ textAlign: 'right' }}>Preparado</th>
              <th>Ubicación</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ background: item.estado === 'listo' ? '#f0fdf4' : undefined }}>
                <td style={{ fontWeight: 600 }}>{item.producto?.nombre || '—'}</td>
                <td style={{ textAlign: 'right' }}>{Number(item.cantidad_solicitada).toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>
                  {picking.estado !== 'despachado' ? (
                    <input className="form-input" type="number" min="0" max={item.cantidad_solicitada} step="1"
                      defaultValue={Number(item.cantidad_preparada)}
                      onBlur={(e) => handleUpdateItem(item.id, e.target.value)}
                      style={{ width: 70, fontSize: '0.82rem', padding: '4px 8px', textAlign: 'right' }} />
                  ) : (
                    <span>{Number(item.cantidad_preparada).toLocaleString()}</span>
                  )}
                </td>
                <td className="meta">{item.ubicacion ? `${item.ubicacion.nombre} (${item.ubicacion.pasillo || ''} ${item.ubicacion.estante || ''})` : '—'}</td>
                <td>{item.estado === 'listo' ? <span className="badge" style={{ background: '#dcfce7', color: '#16a34a' }}>✅</span> : <span className="badge" style={{ background: '#fef3c7', color: '#d97706' }}>⏳</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal despachar */}
      {showDespachar && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowDespachar(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 420, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>📦 Despachar pedido</h3>
              <button onClick={() => setShowDespachar(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select className="form-input" value={envio.almacen_id} onChange={(e) => setEnvio((p) => ({ ...p, almacen_id: e.target.value }))}>
                <option value="">— Almacén de salida —</option>
                {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
              <select className="form-input" value={envio.transportista_id} onChange={(e) => setEnvio((p) => ({ ...p, transportista_id: e.target.value }))}>
                <option value="">— Transportista —</option>
                {transportistas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              <input className="form-input" placeholder="Chofer" value={envio.chofer} onChange={(e) => setEnvio((p) => ({ ...p, chofer: e.target.value }))} />
              <input className="form-input" placeholder="Patente / Matrícula" value={envio.patente} onChange={(e) => setEnvio((p) => ({ ...p, patente: e.target.value }))} />
              <input className="form-input" placeholder="Destino" value={envio.destino} onChange={(e) => setEnvio((p) => ({ ...p, destino: e.target.value }))} />
              <Button onClick={handleDespachar}>✅ Generar remito y despachar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
