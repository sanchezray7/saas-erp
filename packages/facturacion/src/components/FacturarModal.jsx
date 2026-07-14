import { useState, useEffect } from 'react'
import { Button, alertError, notify, formatMoney, getSupabase } from '@saas/core'
import { useFacturacion } from '@saas/facturacion'
import { generarAsientoFacturaCliente, copiarTaxLinesACliente } from '@saas/accounting'
import { listarAlmacenes, registrarMovimientoStock, crearPicking } from '@saas/inventario'
import { anularFactura } from '../data/facturacion'

export function FacturarModal({ cotizacion, companyData, onClose, onFacturada }) {
  const { emitirFactura, loading } = useFacturacion()
  const [result, setResult] = useState(null)
  const paymentDays = companyData?.payment_terms_days || 30
  const defaultVenc = new Date(Date.now() + paymentDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [vencimiento, setVencimiento] = useState(defaultVenc)
  const [almacenes, setAlmacenes] = useState([])
  const [stockAlmacenId, setStockAlmacenId] = useState('')
  const [descontando, setDescontando] = useState(false)
  const [generandoPicking, setGenerandoPicking] = useState(false)
  const [anulando, setAnulando] = useState(false)

  const items = cotizacion.items || []
  const total = items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0)

  useEffect(() => {
    listarAlmacenes(companyData.company_id).then((a) => { setAlmacenes(a); if (a.length > 0) setStockAlmacenId(a[0].id) }).catch(() => {})
  }, [companyData.company_id])

  async function handleFacturar() {
    try {
      // Verificar stock antes de emitir
      const itemsConProducto = items.filter((i) => i.producto_id)
      if (itemsConProducto.length > 0) {
        const supabase = getSupabase()
        const sinStock = []
        for (const item of itemsConProducto) {
          const { data: stock } = await supabase
            .from('producto_stock')
            .select('cantidad')
            .eq('company_id', companyData.company_id)
            .eq('producto_id', item.producto_id)
          const totalDisponible = (stock || []).reduce((s, r) => s + Number(r.cantidad), 0)
          if (totalDisponible < Number(item.cantidad)) {
            sinStock.push({
              producto: item.descripcion || item.producto_id,
              disponible: totalDisponible,
              requerido: Number(item.cantidad),
            })
          }
        }
        if (sinStock.length > 0) {
          const msg = sinStock.map((s) => `${s.producto}: disponible ${s.disponible}, requerido ${s.requerido}`).join('\n')
          alertError('Stock insuficiente', msg)
          return
        }
      }
      const res = await emitirFactura({
        empresa: {
          id: companyData.company_id,
          ruc_factura: companyData.ruc_factura,
          dv_factura: companyData.dv_factura,
          name: companyData.name,
          direccion: companyData.direccion,
          telefono: companyData.telefono,
          email_empresa: companyData.email_empresa,
          actividad_economica: companyData.actividad_economica,
          des_actividad_economica: companyData.des_actividad_economica,
          timbrado: companyData.timbrado,
          establecimiento: companyData.establecimiento || 1,
          punto_expedicion: companyData.punto_expedicion || 1,
        },
        cliente: {
          name: cotizacion.contact?.name,
          ruc: cotizacion.contact?.ruc,
          dv: cotizacion.contact?.dv,
          tipo_documento: cotizacion.contact?.tipo_documento,
          num_documento: cotizacion.contact?.num_documento,
          pais: cotizacion.contact?.pais,
          direccion: cotizacion.contact?.direccion,
          phone: cotizacion.contact?.phone,
          email: cotizacion.contact?.email,
        },
        items: items.map((i) => ({
          descripcion: i.descripcion,
          cantidad: Number(i.cantidad),
          precio_unitario: Number(i.precio_unitario),
          tasaIVA: 10,
        })),
        moneda: cotizacion.moneda || 'PYG',
        cotizacion_id: cotizacion.id,
        fecha_vencimiento: vencimiento,
        subtotal: cotizacion.subtotal || 0,
        impuesto: cotizacion.impuesto || 0,
      })

      setResult(res)

      // Cambiar estado si fue aprobada
      if (res.estado === 'APROBADO') {
        try {
          const supabase = getSupabase()
          await supabase.from('cotizaciones').update({ estado: 'facturada' }).eq('id', cotizacion.id)
          onFacturada?.()
          // Copiar tax lines de la cotización y generar asiento contable
          await copiarTaxLinesACliente(cotizacion.id, res.facturaId)
          const asiento = await generarAsientoFacturaCliente(res.facturaId)
          if (asiento?.entry_number) notify(`Asiento ${asiento.entry_number} generado`)
        } catch (e) {
          console.warn('Error al generar asiento:', e)
        }
      }
    } catch (err) {
      alertError('Error al facturar', err.message)
    }
  }

  async function handleDescontarStock() {
    if (!stockAlmacenId) { alertError('Error', 'Seleccioná un almacén'); return }
    setDescontando(true)
    try {
      const supabase = getSupabase()
      for (const item of items) {
        if (!item.producto_id) continue
        await registrarMovimientoStock(companyData.company_id, null, {
          producto_id: item.producto_id,
          almacen_id: stockAlmacenId,
          tipo: 'salida',
          cantidad: Number(item.cantidad),
          referencia_type: 'factura_cliente',
          motivo: 'Factura ' + (result.numeroFormateado || ''),
        })
      }
      notify('Stock descontado correctamente')
    } catch (err) { alertError('Error al descontar stock', err.message) }
    finally { setDescontando(false) }
  }

  async function handleGenerarPicking() {
    setGenerandoPicking(true)
    try {
      const supabase = getSupabase()
      const { data: numData } = await supabase.rpc('generar_numero_picking', { p_company_id: companyData.company_id })
      const numero = numData || 'PK-' + Date.now().toString(36).toUpperCase()
      const pickItems = items.filter((i) => i.producto_id).map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad }))
      await crearPicking(companyData.company_id, null, result?.facturaId, pickItems, numero)
      notify(`Picking ${numero} generado`)
    } catch (err) { alertError('Error al generar picking', err.message) }
    finally { setGenerandoPicking(false) }
  }

  async function handleAnular() {
    if (!window.confirm('¿Anular esta factura? La cotización volverá a estado "aceptada".')) return
    setAnulando(true)
    try {
      await anularFactura(result.facturaId)
      notify('Factura anulada')
      onClose()
    } catch (err) { alertError('Error al anular', err.message) }
    finally { setAnulando(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--color-surface)', borderRadius: 12,
        padding: 24, width: '100%', maxWidth: 520,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        maxHeight: '90vh', overflow: 'auto',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>💵 Facturar cotización</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        {!result ? (
          <>
            <div style={{ marginBottom: 16, fontSize: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><span className="meta">Cotización:</span> {cotizacion.numero}</div>
                <div><span className="meta">Cliente:</span> {cotizacion.contact?.name}</div>
                <div><span className="meta">Total:</span> {formatMoney(total, cotizacion.moneda || 'PYG')}</div>
                <div><span className="meta">Items:</span> {items.length}</div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Vencimiento</label>
              <input className="form-input" type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} style={{ width: '100%' }} />
            </div>

            <div style={{
              padding: 12, background: 'var(--bg-soft)', borderRadius: 8, marginBottom: 16, fontSize: '0.8rem',
            }}>
              <strong>Timbrado:</strong> {companyData.timbrado || '—'} |
              <strong> Est:</strong> {companyData.establecimiento || '—'} |
              <strong> Pto Exp:</strong> {companyData.punto_expedicion || '—'}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={handleFacturar} disabled={loading}>
                {loading ? 'Facturando...' : '💵 Emitir factura electrónica'}
              </Button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>
              {result.estado === 'APROBADO' ? '✅' : '❌'}
            </div>
            <h4 style={{ margin: '0 0 8px', fontSize: '1rem' }}>
              {result.estado === 'APROBADO' ? 'Factura aprobada' : 'Factura rechazada'}
            </h4>
            {result.cdc && (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', wordBreak: 'break-all', marginBottom: 8 }}>
                CDC: {result.cdc}
              </div>
            )}
            {result.numeroFormateado && (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                N°: {result.numeroFormateado}
              </div>
            )}

            {/* Descontar stock */}
            {result.estado === 'APROBADO' && almacenes.length > 0 && items.some((i) => i.producto_id) && (
              <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 12, paddingTop: 12, textAlign: 'left' }}>
                <h5 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 8px' }}>📦 Descontar stock</h5>
                <div style={{ marginBottom: 8 }}>
                  <select className="form-input" value={stockAlmacenId} onChange={(e) => setStockAlmacenId(e.target.value)} style={{ width: '100%', fontSize: '0.82rem' }}>
                    {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                  {items.filter((i) => i.producto_id).length} de {items.length} items con producto vinculado
                </div>
                <Button size="sm" onClick={handleDescontarStock} disabled={descontando} style={{ width: '100%' }}>
                  {descontando ? 'Descontando...' : '📤 Registrar salida de stock'}
                </Button>
              </div>
            )}

            {/* Generar picking */}
            {result.estado === 'APROBADO' && items.some((i) => i.producto_id) && (
              <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 12, paddingTop: 12, textAlign: 'left' }}>
                <h5 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 8px' }}>📋 Preparar pedido</h5>
                <Button size="sm" onClick={handleGenerarPicking} disabled={generandoPicking} style={{ width: '100%' }}>
                  {generandoPicking ? 'Generando...' : '📋 Generar orden de picking'}
                </Button>
              </div>
            )}

            {/* Anular factura */}
            {result.estado === 'APROBADO' && (
              <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 12, paddingTop: 12, textAlign: 'left' }}>
                <Button size="sm" variant="ghost" onClick={handleAnular} disabled={anulando} style={{ width: '100%', color: 'var(--color-danger)' }}>
                  {anulando ? 'Anulando...' : '🗑 Anular factura'}
                </Button>
              </div>
            )}

            {result.errores && result.errores.length > 0 && (
              <div style={{ fontSize: '0.82rem', color: 'var(--color-danger)', marginBottom: 8 }}>
                {result.errores.map((e, i) => (
                  <div key={i}>{e.codigo}: {e.descripcion}</div>
                ))}
              </div>
            )}
            <Button size="sm" onClick={onClose} style={{ marginTop: 12 }}>Cerrar</Button>
          </div>
        )}
      </div>
    </div>
  )
}
