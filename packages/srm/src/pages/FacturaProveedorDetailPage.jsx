import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, alertError, notify, FormField } from '@saas/core'
import { obtenerFacturaProveedor, actualizarEstadoFactura, cotejarFactura } from '../data/proveedorFacturas'
import { listarMediosPago, listarPagosProveedor, registrarPagoProveedor, eliminarPagoProveedor } from '../data/pagosProveedor'
import { listarInvoiceTaxLines, calcularResumenImpuestos, generarAsientoFacturaProveedor, generarAsientoPagoProveedor, listarAccounts } from '@saas/accounting'

const ESTADOS = ['pendiente', 'conciliada', 'discrepancia', 'pagada', 'anulada']

const BADGE = {
  pendiente: { bg: '#fef3c7', color: '#d97706' },
  conciliada: { bg: '#dcfce7', color: '#16a34a' },
  discrepancia: { bg: '#fef2f2', color: '#dc2626' },
  pagada: { bg: '#e0f2fe', color: '#0284c7' },
  anulada: { bg: '#f5f5f5', color: '#9ca3af' },
}

export function FacturaProveedorDetailPage() {
  const { id } = useParams()
  const { user, activeCompanyId } = useAuth()
  const [factura, setFactura] = useState(null)
  const [cotejo, setCotejo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cotejando, setCotejando] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  const [taxLines, setTaxLines] = useState([])
  const [showPagoModal, setShowPagoModal] = useState(false)
  const [pagos, setPagos] = useState([])
  const [mediosPago, setMediosPago] = useState([])
  const [cuentasBanco, setCuentasBanco] = useState([])
  const [pago, setPago] = useState({ medio_pago_id: '', cuenta_banco_id: '', monto: '', referencia: '', fecha_pago: new Date().toISOString().slice(0, 10) })
  const [pagoLoading, setPagoLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const f = await obtenerFacturaProveedor(id)
      setFactura(f)
    } catch (_) {}
    try {
      const [tl, p, mp, cb] = await Promise.all([
        listarInvoiceTaxLines('proveedor', id).catch(() => []),
        listarPagosProveedor(id).catch(() => []),
        listarMediosPago(activeCompanyId).catch(() => []),
        listarAccounts(activeCompanyId).then((a) => a.filter((acc) => acc.code?.startsWith('1.1.1') || acc.code?.startsWith('1.1.2'))).catch(() => []),
      ])
      setTaxLines(tl); setPagos(p); setMediosPago(mp); setCuentasBanco(cb)
    } catch (_) {}
    finally { setLoading(false) }
  }, [id, activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleCotejar() {
    setCotejando(true)
    try {
      const result = await cotejarFactura(id)
      setCotejo(result)
    } catch (err) { alertError('Error al cotejar', err.message) }
    finally { setCotejando(false) }
  }

  const saldoPendiente = Number(factura?.saldo_pendiente ?? factura?.total ?? 0)

  async function handleCambiarEstado(estado) {
    if (estado === 'pagada' && saldoPendiente > 0) {
      setPago({ medio_pago_id: '', cuenta_banco_id: '', monto: String(saldoPendiente), referencia: '', fecha_pago: new Date().toISOString().slice(0, 10) })
      setShowPagoModal(true)
      return
    }
    setCambiando(true)
    try {
      await actualizarEstadoFactura(id, estado)
      setFactura((prev) => ({ ...prev, estado }))
      notify(`Estado: ${estado}`)
      if (estado === 'conciliada') {
        try {
          const asiento = await generarAsientoFacturaProveedor(id)
          if (asiento?.entry_number) notify(`Asiento ${asiento.entry_number} generado`)
        } catch (err) { alertError('Error al generar asiento', err.message) }
      }
    } catch (err) { alertError('Error', err.message) }
    finally { setCambiando(false) }
  }

  async function handleConfirmarPago() {
    if (!pago.monto || Number(pago.monto) <= 0) { alertError('Error', 'Ingresá un monto válido'); return }
    if (Number(pago.monto) > saldoPendiente) { alertError('Error', 'El monto supera el saldo pendiente'); return }
    setPagoLoading(true)
    try {
      await registrarPagoProveedor(activeCompanyId, user?.id, { factura_id: id, ...pago, monto: Number(pago.monto) })
      notify('Pago registrado')
      setShowPagoModal(false)
      await load()
      // Generar asiento de pago si se pagó completo
      if (Number(pago.monto) >= saldoPendiente) {
        try {
          if (pago.cuenta_banco_id) {
            const asiento = await generarAsientoPagoProveedor(id, pago.cuenta_banco_id)
            if (asiento?.entry_number) notify(`Asiento de pago ${asiento.entry_number} generado`)
          }
        } catch (err) { console.warn('Asiento de pago no generado:', err.message) }
      }
    } catch (err) { alertError('Error', err.message) }
    finally { setPagoLoading(false) }
  }

  async function handleEliminarPago(pagoId) {
    if (!window.confirm('¿Eliminar este pago?')) return
    try {
      await eliminarPagoProveedor(pagoId, id)
      notify('Pago eliminado')
      await load()
    } catch (err) { alertError('Error', err.message) }
  }

  if (loading) return <Skeleton.Card />
  if (!factura) return <div className="card"><p className="meta">Factura no encontrada</p></div>

  const badge = BADGE[factura.estado] || BADGE.pendiente
  const totalPagado = pagos.reduce((s, p) => s + Number(p.monto), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/facturas-proveedor"><Button variant="ghost" size="sm">Volver</Button></Link>
        {factura.estado === 'pendiente' && (
          <Link to={`/facturas-proveedor/${id}/editar`}><Button size="sm">Editar</Button></Link>
        )}
      </div>

      <div className="card">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1rem', margin: 0 }}>FACTURA DE PROVEEDOR</h1>
            <p className="meta" style={{ fontSize: '0.82rem' }}>N° {factura.numero_factura}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="badge" style={{ background: badge.bg, color: badge.color, fontSize: '0.85rem', padding: '4px 12px' }}>{factura.estado}</span>
          </div>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', marginBottom: 16 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Proveedor</div>
            <div>{factura.proveedor?.nombre || '—'}</div>
            <div className="meta">{factura.proveedor?.ruc || ''}</div>
            <div className="meta">{factura.proveedor?.telefono || ''}</div>
            <div className="meta">{factura.proveedor?.email || ''}</div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Detalles</div>
            <div className="meta">Emisión: {factura.fecha_emision?.slice(0, 10)}</div>
            <div className="meta">Vencimiento: {factura.fecha_vencimiento?.slice(0, 10) || '—'}</div>
            {factura.timbrado && <div className="meta">Timbrado: {factura.timbrado}</div>}
          </div>
        </div>

        <table className="table" style={{ marginBottom: 16 }}>
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
            {(factura.items || []).map((item) => (
              <tr key={item.id}>
                <td style={{ fontWeight: 600 }}>{item.producto?.nombre || '—'}</td>
                <td className="meta">{item.descripcion || '—'}</td>
                <td style={{ textAlign: 'right' }}>{Number(item.cantidad).toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{formatMoney(item.precio_unitario, factura.moneda)}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(item.subtotal, factura.moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.9rem' }}>Subtotal: {formatMoney(factura.subtotal, factura.moneda)}</div>
          {taxLines.length > 0 ? (
            <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 4, paddingTop: 4 }}>
              {(() => {
                const grouped = {}
                taxLines.forEach((l) => {
                  const key = l.tax_id
                  if (!grouped[key]) grouped[key] = { ...l.tax, tax_amount: 0 }
                  grouped[key].tax_amount += Number(l.tax_amount)
                })
                const res = calcularResumenImpuestos(Object.values(grouped), factura.subtotal || 0)
                return res.lines.map((t, i) => (
                  <div key={i} style={{ fontSize: '0.82rem', display: 'flex', justifyContent: 'flex-end', gap: 8, color: t.is_withholding ? '#dc2626' : undefined }}>
                    <span>{t.is_withholding ? '⛔' : '🧾'} {t.name} ({Number(t.percentage).toFixed(1)}%)</span>
                    <span style={{ fontWeight: 600 }}>{t.is_withholding ? '-' : '+'} {formatMoney(t.tax_amount, factura.moneda)}</span>
                  </div>
                ))
              })()}
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem' }}>Impuesto: {formatMoney(factura.impuesto, factura.moneda)}</div>
          )}
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 4 }}>Total: {formatMoney(factura.total, factura.moneda)}</div>
          {saldoPendiente > 0 ? (
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#dc2626', marginTop: 2 }}>Saldo: {formatMoney(saldoPendiente, factura.moneda)}</div>
          ) : (
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#16a34a', marginTop: 2 }}>✅ Pagado</div>
          )}
        </div>

        {factura.notas && (
          <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-soft)', borderRadius: 6 }}>
            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.85rem' }}>Notas</div>
            <p className="meta" style={{ whiteSpace: 'pre-wrap' }}>{factura.notas}</p>
          </div>
        )}
      </div>

      {/* Cotejo 3 vías */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>🔍 Cotejo OC ↔ Recepción ↔ Factura</h3>
          <Button size="sm" onClick={handleCotejar} disabled={cotejando || !factura.orden_id}>
            {cotejando ? 'Cotejando...' : 'Cotejar'}
          </Button>
        </div>
        {!factura.orden_id && (
          <p className="meta" style={{ padding: 16, textAlign: 'center' }}>
            Esta factura no está vinculada a una orden de compra. El cotejo requiere una OC asociada.
          </p>
        )}
        {cotejo && (
          <>
            <div style={{ background: cotejo.discrepancia ? '#fef2f2' : '#dcfce7', color: cotejo.discrepancia ? '#dc2626' : '#16a34a', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontWeight: 600, fontSize: '0.85rem' }}>
              {cotejo.discrepancia ? '⚠️ Se detectaron discrepancias' : '✅ Todo coincide'}
            </div>
            <table className="table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style={{ textAlign: 'right' }}>Pedido</th>
                  <th style={{ textAlign: 'right' }}>Recibido</th>
                  <th style={{ textAlign: 'right' }}>Facturado</th>
                  <th style={{ textAlign: 'right', borderLeft: '2px solid var(--color-border)' }}>Precio OC</th>
                  <th style={{ textAlign: 'right' }}>Precio Fact.</th>
                  <th style={{ textAlign: 'center' }}>Cant.</th>
                  <th style={{ textAlign: 'center' }}>Precio</th>
                </tr>
              </thead>
              <tbody>
                {(cotejo.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{item.descripcion || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{Number(item.cantidad_pedida).toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{Number(item.cantidad_recibida).toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{Number(item.cantidad_facturada).toLocaleString()}</td>
                    <td style={{ textAlign: 'right', borderLeft: '2px solid var(--color-border)' }}>{formatMoney(item.precio_oc, cotejo.moneda)}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(item.precio_factura, cotejo.moneda)}</td>
                    <td style={{ textAlign: 'center' }}>{item.coincide_cantidad === null ? '—' : item.coincide_cantidad ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center' }}>{item.coincide_precio === null ? '—' : item.coincide_precio ? '✅' : '❌'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Historial de pagos */}
      <div className="card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>💰 Pagos realizados</h3>
          {saldoPendiente > 0 && (
            <Button size="sm" onClick={() => { setPago({ medio_pago_id: '', cuenta_banco_id: '', monto: String(saldoPendiente), referencia: '', fecha_pago: new Date().toISOString().slice(0, 10) }); setShowPagoModal(true) }}>
              + Registrar pago
            </Button>
          )}
        </div>
        {pagos.length === 0 ? (
          <p className="meta" style={{ padding: 16, textAlign: 'center' }}>Sin pagos registrados</p>
        ) : (
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Medio de pago</th>
                  <th>Cuenta</th>
                  <th>Referencia</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td className="meta">{p.fecha_pago?.slice(0, 10)}</td>
                    <td style={{ fontWeight: 600, color: '#16a34a' }}>{formatMoney(p.monto, factura.moneda)}</td>
                    <td>{p.medio_pago?.nombre || '—'}</td>
                    <td className="meta">{p.cuenta_banco ? `${p.cuenta_banco.code} ${p.cuenta_banco.name}` : '—'}</td>
                    <td className="meta">{p.referencia || '—'}</td>
                    <td>
                      <button onClick={() => handleEliminarPago(p.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.82rem' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
                  <td>Total pagado</td>
                  <td style={{ color: '#16a34a' }}>{formatMoney(totalPagado, factura.moneda)}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Estado selector */}
      <div className="card">
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8 }}>Estado</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="form-input" value={factura.estado} onChange={(e) => handleCambiarEstado(e.target.value)} disabled={cambiando} style={{ width: 180, fontSize: '0.85rem' }}>
            {ESTADOS.map((est) => <option key={est} value={est}>{est}</option>)}
          </select>
          {cambiando && <span className="meta" style={{ fontSize: '0.78rem' }}>Cambiando...</span>}
        </div>
      </div>

      {/* Modal registrar pago */}
      {showPagoModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => !pagoLoading && setShowPagoModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 420, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>💰 Registrar pago</h3>
              <button onClick={() => setShowPagoModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <p className="meta" style={{ marginBottom: 12, fontSize: '0.85rem' }}>
              Factura <strong>{factura.numero_factura}</strong> · Saldo: <strong style={{ color: '#dc2626' }}>{formatMoney(saldoPendiente, factura.moneda)}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FormField label="Monto" type="number" min="0" step="0.01" value={pago.monto} onChange={(e) => setPago((prev) => ({ ...prev, monto: e.target.value }))} />
              <FormField label="Fecha de pago" type="date" value={pago.fecha_pago} onChange={(e) => setPago((prev) => ({ ...prev, fecha_pago: e.target.value }))} />
              <FormField label="Medio de pago" as="select" value={pago.medio_pago_id} onChange={(e) => setPago((prev) => ({ ...prev, medio_pago_id: e.target.value }))}>
                <option value="">— Seleccionar —</option>
                {mediosPago.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </FormField>
              <FormField label="Cuenta bancaria / Caja" as="select" value={pago.cuenta_banco_id} onChange={(e) => setPago((prev) => ({ ...prev, cuenta_banco_id: e.target.value }))}>
                <option value="">— Seleccionar —</option>
                {cuentasBanco.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </FormField>
              <FormField label="Referencia (cheque, transferencia)" value={pago.referencia} onChange={(e) => setPago((prev) => ({ ...prev, referencia: e.target.value }))} placeholder="N° cheque / N° transferencia" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <Button variant="ghost" size="sm" onClick={() => setShowPagoModal(false)} disabled={pagoLoading}>Cancelar</Button>
              <Button size="sm" onClick={handleConfirmarPago} disabled={pagoLoading || !pago.monto || Number(pago.monto) <= 0}>
                {pagoLoading ? 'Procesando...' : '✅ Registrar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
