import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, MONEDA_POR_PAIS, FormField, alertError, notify } from '@saas/core'
import { obtenerOrden, registrarRecepcion, actualizarEstadoOrden } from '../data/ordenesCompra'
import { enviarWhatsApp } from '@saas/whatsapp'
import { listarAlmacenes, registrarMovimientoStock } from '@saas/inventario'

const ESTADOS = ['borrador', 'enviada', 'confirmada', 'recibida', 'cancelada']

export function OrdenCompraDetailPage() {
  const { id } = useParams()
  const { activeCompanyId, pais, user, companies } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'PYG'
  const companyName = companies.find((c) => c.id === activeCompanyId)?.name || ''
  const [orden, setOrden] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cambiando, setCambiando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [showRecibir, setShowRecibir] = useState(false)
  const [recibirItems, setRecibirItems] = useState([])
  const [recibiendo, setRecibiendo] = useState(false)
  const [almacenes, setAlmacenes] = useState([])
  const [almacenId, setAlmacenId] = useState('')

  useEffect(() => {
    obtenerOrden(id).then(setOrden).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  async function handleCambiarEstado(estado) {
    setCambiando(true)
    try {
      await actualizarEstadoOrden(id, estado)
      setOrden((prev) => ({ ...prev, estado }))
      notify(`Estado: ${estado}`)
    } catch (err) { alertError('Error', err.message) }
    finally { setCambiando(false) }
  }

  function abrirRecibir() {
    listarAlmacenes(activeCompanyId).then((a) => { setAlmacenes(a); if (a.length > 0) setAlmacenId(a[0].id) }).catch(() => {})
    setRecibirItems((orden.items || []).map((i) => {
      const pendiente = Math.max(0, Number(i.cantidad) - Number(i.cantidad_recibida || 0))
      return { orden_item_id: i.id, producto_id: i.producto_id, nombre: i.producto?.nombre || i.descripcion || '—', pendiente, cantidad_recibida: pendiente, precio_unitario: Number(i.precio_unitario), lote: '', fecha_vencimiento: '' }
    }))
    setShowRecibir(true)
  }

  function updateRecibirItem(idx, field, value) {
    setRecibirItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  async function handleConfirmarRecepcion() {
    const aRecibir = recibirItems.filter((i) => i.cantidad_recibida > 0)
    if (aRecibir.length === 0) return
    if (!almacenId) { alertError('Error', 'Seleccioná un almacén'); return }
    setRecibiendo(true)
    try {
      const { completo } = await registrarRecepcion(activeCompanyId, id, aRecibir)
      // Registrar movimientos de stock por cada item recibido
      for (const item of aRecibir) {
        await registrarMovimientoStock(activeCompanyId, user?.id, {
          producto_id: item.producto_id,
          almacen_id: almacenId,
          tipo: 'entrada',
          cantidad: Number(item.cantidad_recibida),
          lote: item.lote || null,
          fecha_vencimiento: item.fecha_vencimiento || null,
          referencia_type: 'recepcion',
          costo_unitario: Number(item.precio_unitario) || undefined,
          motivo: 'Recepción de OC',
        })
      }
      notify(completo ? 'Recepción completa' : 'Recepción parcial registrada')
      setShowRecibir(false)
      const updated = await obtenerOrden(id)
      setOrden(updated)
    } catch (err) { alertError('Error', err?.message || err?.description || JSON.stringify(err)) }
    finally { setRecibiendo(false) }
  }

  function handleDescargarPDF() {
    window.print()
  }

  async function handleEnviarWhatsApp() {
    if (!orden.proveedor?.telefono) {
      alertError('Error', 'El proveedor no tiene teléfono')
      return
    }
    if (!window.confirm(`¿Enviar la OC ${orden.numero} por WhatsApp a ${orden.proveedor.nombre}?`)) return
    setEnviando(true)
    try {
      const items = (orden.items || []).slice(0, 5).map((i) =>
        `• ${i.producto?.nombre || i.descripcion || '—'} x${Number(i.cantidad)} — ${formatMoney(i.subtotal, orden.moneda)}`
      ).join('\n')
      const masItems = (orden.items || []).length > 5 ? `\n... y ${(orden.items || []).length - 5} items más` : ''
      const msg = `📄 *ORDEN DE COMPRA ${orden.numero}*\n\nHola ${orden.proveedor.nombre},\n\nTe enviamos nuestra orden de compra:\n\n${items}${masItems}\n\n*Total: ${formatMoney(orden.total, orden.moneda)}*\n\n${orden.notas ? `Notas: ${orden.notas}\n\n` : ''}Quedamos atentos a la confirmación.`
      await enviarWhatsApp({
        companyId: activeCompanyId,
        proveedorId: orden.proveedor_id,
        to: orden.proveedor.telefono,
        body: msg,
      })
      notify('OC enviada por WhatsApp')
      if (orden.estado === 'borrador' || orden.estado === 'confirmada') {
        await handleCambiarEstado('enviada')
      }
    } catch (err) { alertError('Error al enviar WhatsApp', err.message) }
    finally { setEnviando(false) }
  }

  if (loading) return <Skeleton.Card />
  if (!orden) return <div className="card"><p className="meta">Orden no encontrada</p></div>

  return (
    <>
      {/* Barra de acciones (no visible en print) */}
      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Link to="/ordenes-compra"><Button variant="ghost" size="sm">Volver</Button></Link>
        {orden.estado !== 'cancelada' && orden.estado !== 'recibida' && (
          <Link to={`/ordenes-compra/${id}/editar`}><Button size="sm">Editar</Button></Link>
        )}
        {orden.proveedor?.telefono && (
          <Button size="sm" variant="ghost" onClick={handleEnviarWhatsApp} disabled={enviando}>{enviando ? 'Enviando...' : '📤 WhatsApp'}</Button>
        )}
        <Button size="sm" variant="ghost" onClick={handleDescargarPDF}>📥 PDF</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="card" id="orden-print">
          <div className="page-header">
            <div>
              <h1 style={{ fontSize: '1rem', margin: 0 }}>ORDEN DE COMPRA</h1>
              <p className="meta" style={{ fontSize: '0.82rem' }}>N° {orden.numero}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700 }}>{companyName}</div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', marginBottom: 16 }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Proveedor</div>
              <div>{orden.proveedor?.nombre || '—'}</div>
              <div className="meta">{orden.proveedor?.ruc || ''}</div>
              <div className="meta">{orden.proveedor?.telefono || ''}</div>
              <div className="meta">{orden.proveedor?.email || ''}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Detalles</div>
              <div className="meta">Fecha: {orden.created_at?.slice(0, 10)}</div>
              <div className="meta">Estado: {orden.estado}</div>
              {orden.fecha_entrega_estimada && <div className="meta">Entrega: {orden.fecha_entrega_estimada}</div>}
            </div>
          </div>

          <table className="table" style={{ marginBottom: 20 }}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Descripción</th>
                <th style={{ textAlign: 'right' }}>Cant.</th>
                <th style={{ textAlign: 'right' }}>Precio</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(orden.items || []).map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.producto?.nombre || '—'}</td>
                  <td className="meta">{item.descripcion || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{Number(item.cantidad).toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(item.precio_unitario, orden.moneda)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(item.subtotal, orden.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ textAlign: 'right', fontSize: '1.1rem', fontWeight: 700 }}>
            Total: {formatMoney(orden.total, orden.moneda)}
          </div>

          {orden.notas && (
            <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-soft)', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.85rem' }}>Notas</div>
              <p className="meta" style={{ whiteSpace: 'pre-wrap' }}>{orden.notas}</p>
            </div>
          )}
        </div>

        {orden.estado === 'confirmada' && (
          <div className="card no-print" style={{ textAlign: 'center', padding: 24 }}>
            <Button size="sm" onClick={abrirRecibir}>📦 Recibir mercadería</Button>
          </div>
        )}

        <div className="card no-print">
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8 }}>Estado</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-input" value={orden.estado} onChange={(e) => handleCambiarEstado(e.target.value)} disabled={cambiando} style={{ width: 180, fontSize: '0.85rem' }}>
              {ESTADOS.map((est) => <option key={est} value={est}>{est}</option>)}
            </select>
            {cambiando && <span className="meta" style={{ fontSize: '0.78rem' }}>Cambiando...</span>}
          </div>
        </div>
      </div>

      {/* Modal recepción parcial */}
      {showRecibir && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => !recibiendo && setShowRecibir(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 520, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>📦 Recibir mercadería</h3>
              <button onClick={() => setShowRecibir(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <FormField label="Almacén de destino" as="select" value={almacenId} onChange={(e) => setAlmacenId(e.target.value)}>
                {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </FormField>
            </div>

            <table className="table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style={{ textAlign: 'right' }}>Pendiente</th>
                  <th style={{ textAlign: 'right' }}>A recibir</th>
                  <th style={{ width: 80 }}>Lote</th>
                  <th style={{ width: 100 }}>Venc.</th>
                </tr>
              </thead>
              <tbody>
                {recibirItems.map((item, idx) => (
                  <tr key={item.orden_item_id}>
                    <td style={{ fontWeight: 600 }}>{item.nombre}</td>
                    <td style={{ textAlign: 'right' }}>{item.pendiente}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input className="form-input" type="number" min="0" max={item.pendiente} step="1"
                        value={item.cantidad_recibida}
                        onChange={(e) => updateRecibirItem(idx, 'cantidad_recibida', Math.min(Math.max(0, Number(e.target.value)), item.pendiente))}
                        style={{ width: 70, fontSize: '0.82rem', padding: '4px 8px', textAlign: 'right' }} />
                    </td>
                    <td><input className="form-input" style={{ fontSize: '0.78rem', padding: '4px 6px', width: 70 }} value={item.lote} onChange={(e) => updateRecibirItem(idx, 'lote', e.target.value)} /></td>
                    <td><input className="form-input" style={{ fontSize: '0.78rem', padding: '4px 6px', width: 95 }} type="date" value={item.fecha_vencimiento} onChange={(e) => updateRecibirItem(idx, 'fecha_vencimiento', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <Button variant="ghost" size="sm" onClick={() => setShowRecibir(false)} disabled={recibiendo}>Cancelar</Button>
              <Button size="sm" onClick={handleConfirmarRecepcion} disabled={recibiendo || recibirItems.every((i) => i.cantidad_recibida <= 0)}>
                {recibiendo ? 'Recibiendo...' : 'Confirmar recepción'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @page { margin: 15mm; size: A4; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          #orden-print { box-shadow: none !important; border: none !important; padding: 0 !important; }
        }
      `}</style>
    </>
  )
}
