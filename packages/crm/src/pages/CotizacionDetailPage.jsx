import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, FormField, Skeleton, formatMoney, alertError, notify, MONEDA_POR_PAIS, getSupabase } from '@saas/core'
import { obtenerCotizacion, actualizarEstadoCotizacion } from '../data/cotizaciones'
import { enviarWhatsApp } from '@saas/whatsapp'
import { FacturarModal, anularFactura } from '@saas/facturacion'
import { listarInvoiceTaxLines, generarAsientoPagoCliente, listarAccounts } from '@saas/accounting'
import { listarCobrosCliente, registrarCobroCliente, eliminarCobroCliente } from '../data/cobrosCliente'

const ESTADOS = ['borrador', 'enviada', 'aceptada', 'rechazada', 'facturada', 'cobrada']
const IRREVERSIBLES = ['aceptada', 'rechazada', 'facturada', 'cobrada']

export function CotizacionDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { activeCompanyId, pais, companies } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'USD'
  const companyName = companies.find((c) => c.id === activeCompanyId)?.name || 'Tu Empresa'
  const [cotizacion, setCotizacion] = useState(null)
  const [companyData, setCompanyData] = useState({ rif: '', direccion: '', telefono: '', email_empresa: '', timbrado: '', establecimiento: '', punto_expedicion: '', ruc_factura: '', dv_factura: '', actividad_economica: '', des_actividad_economica: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [showFacturar, setShowFacturar] = useState(false)
  const [taxLines, setTaxLines] = useState([])
  const [showCobro, setShowCobro] = useState(false)
  const [cuentaCobro, setCuentaCobro] = useState('')
  const [cuentasCobro, setCuentasCobro] = useState([])
  const [cobrando, setCobrando] = useState(false)
  const [cobros, setCobros] = useState([])
  const [mediosPagoCobro, setMediosPagoCobro] = useState([])
  const [cobroForm, setCobroForm] = useState({ medio_pago_id: '', cuenta_banco_id: '', monto: '', referencia: '', fecha_cobro: new Date().toISOString().slice(0, 10) })
  const [anulandoFactura, setAnulandoFactura] = useState(false)

  useEffect(() => {
    obtenerCotizacion(id)
      .then((c) => {
        setCotizacion(c)
        listarInvoiceTaxLines('cliente', c.id).then(setTaxLines).catch(() => {})
      })
      .catch(setError)
    getSupabase()
      .from('companies')
      .select('rif, direccion, telefono, email_empresa, timbrado, establecimiento, punto_expedicion, ruc_factura, dv_factura, actividad_economica, des_actividad_economica')
      .eq('id', activeCompanyId)
      .single()
      .then(({ data }) => {
        if (data) setCompanyData(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, activeCompanyId])

  async function handleCambiarEstado(nuevoEstado) {
    setCambiandoEstado(true)
    try {
      await actualizarEstadoCotizacion(id, nuevoEstado)
      setCotizacion((prev) => ({ ...prev, estado: nuevoEstado }))
      notify(`Estado actualizado a "${nuevoEstado}"`)
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setCambiandoEstado(false)
    }
  }

  async function handleAnularFactura() {
    if (!window.confirm('¿Anular la factura de esta cotización? La cotización volverá a "aceptada".')) return
    setAnulandoFactura(true)
    try {
      const supabase = getSupabase()
      const { data: factura } = await supabase.from('facturas').select('id').eq('cotizacion_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!factura) throw new Error('Factura no encontrada')
      await anularFactura(factura.id)
      notify('Factura anulada')
      obtenerCotizacion(id).then((c) => { setCotizacion(c); listarInvoiceTaxLines('cliente', c.id).then(setTaxLines).catch(() => {}) }).catch(() => {})
    } catch (err) { alertError('Error', err.message) }
    finally { setAnulandoFactura(false) }
  }

  function handleAbrirCobro() {
    const supabase = getSupabase()
    supabase.from('medios_pago').select('*').eq('company_id', activeCompanyId).eq('activo', true).order('nombre').then(({ data }) => setMediosPagoCobro(data || [])).catch(() => {})
    supabase.from('facturas').select('id, total, saldo_pendiente').eq('cotizacion_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        const saldo = Number(data.saldo_pendiente ?? data.total)
        setCobroForm((prev) => ({ ...prev, monto: String(saldo) }))
      }
    }).catch(() => {})
    listarAccounts(activeCompanyId).then((a) => setCuentasCobro(a.filter((acc) => acc.code?.startsWith('1.1.1') || acc.code?.startsWith('1.1.2')))).catch(() => {})
    listarCobrosClientePorCotizacion()
    setShowCobro(true)
  }

  async function listarCobrosClientePorCotizacion() {
    const supabase = getSupabase()
    const { data: factura } = await supabase.from('facturas').select('id').eq('cotizacion_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (factura) {
      listarCobrosCliente(factura.id).then(setCobros).catch(() => {})
    }
  }

  async function handleConfirmarCobro() {
    if (!cobroForm.monto || Number(cobroForm.monto) <= 0) { alertError('Error', 'Ingresá un monto válido'); return }
    setCobrando(true)
    try {
      const supabase = getSupabase()
      const { data: factura } = await supabase.from('facturas').select('id, total, saldo_pendiente').eq('cotizacion_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!factura) { alertError('Error', 'Factura no encontrada'); setCobrando(false); return }

      const saldo = Number(factura.saldo_pendiente ?? factura.total)
      if (Number(cobroForm.monto) > saldo) { alertError('Error', 'El monto supera el saldo pendiente'); setCobrando(false); return }

      await registrarCobroCliente(activeCompanyId, null, {
        factura_id: factura.id,
        medio_pago_id: cobroForm.medio_pago_id || null,
        cuenta_banco_id: cobroForm.cuenta_banco_id || null,
        monto: Number(cobroForm.monto),
        referencia: cobroForm.referencia || null,
        fecha_cobro: cobroForm.fecha_cobro,
      })

      if (Number(cobroForm.monto) >= saldo) {
        await actualizarEstadoCotizacion(id, 'cobrada')
        try {
          if (cobroForm.cuenta_banco_id) {
            const asiento = await generarAsientoPagoCliente(factura.id, cobroForm.cuenta_banco_id)
            if (asiento?.entry_number) notify(`Cobro registrado. Asiento ${asiento.entry_number}`)
          }
        } catch (err) { console.warn('Asiento no generado:', err.message) }
      } else {
        notify('Cobro parcial registrado')
      }

      setShowCobro(false)
      obtenerCotizacion(id).then((c) => { setCotizacion(c); listarInvoiceTaxLines('cliente', c.id).then(setTaxLines).catch(() => {}) }).catch(() => {})
      listarCobrosClientePorCotizacion()
    } catch (err) { alertError('Error', err.message) }
    finally { setCobrando(false) }
  }

  async function handleEnviarWhatsApp() {
    if (!cotizacion.contact?.phone) {
      alertError('Error', 'El contacto no tiene teléfono')
      return
    }
    try {
      const publicUrl = `${window.location.origin}/s/cotizacion/${cotizacion.token}`
      const msg = `📄 *Cotización ${cotizacion.numero}*\n\nHola ${cotizacion.contact.name},\nTe enviamos nuestra cotización por un total de *${formatMoney(cotizacion.total, cotizacion.moneda)}*.\n\nPodés ver los detalles acá:\n${publicUrl}\n\nQuedamos atentos a cualquier consulta.`
      await enviarWhatsApp({
        companyId: activeCompanyId,
        contactId: cotizacion.contact_id,
        to: cotizacion.contact.phone,
        body: msg,
      })
      notify('Cotización enviada por WhatsApp')
      if (cotizacion.estado === 'borrador') {
        await handleCambiarEstado('enviada')
      }
    } catch (err) {
      alertError('Error al enviar WhatsApp', err.message)
    }
  }

  function handleDescargarPDF() {
    window.print()
  }

  if (loading) return <Skeleton.Card />
  if (error) return <div className="card"><p className="meta">Error: {error.message}</p></div>
  if (!cotizacion) return <div className="card"><p className="meta">{t('common.sinDatos')}</p></div>

  const badgeColor = {
    borrador: 'var(--text-muted)',
    enviada: '#1d4ed8',
    aceptada: '#16a34a',
    rechazada: '#dc2626',
  }

  return (
    <>
      {/* Barra de acciones (solo en pantalla, no en print) */}
      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <Link to="/cotizaciones"><Button variant="ghost" size="sm">{t('common.volver')}</Button></Link>
            {!IRREVERSIBLES.includes(cotizacion.estado) && (
              <Link to={`/cotizaciones/${id}/edit`}><Button size="sm">{t('common.editar')}</Button></Link>
            )}
            <select
              className="form-input"
              value={cotizacion.estado}
              onChange={(e) => handleCambiarEstado(e.target.value)}
              disabled={cambiandoEstado || IRREVERSIBLES.includes(cotizacion.estado)}
              style={{ fontSize: '0.82rem', padding: '4px 8px', maxWidth: 130 }}
            >
              {ESTADOS.map((est) => (
                <option key={est} value={est} disabled={IRREVERSIBLES.includes(est) && est !== cotizacion.estado}>
                  {est}
                </option>
              ))}
            </select>
            {cotizacion.estado === 'aceptada' && (
              <Button size="sm" variant="ghost" onClick={() => setShowFacturar(true)}>💵 Facturar</Button>
            )}
            {cotizacion.estado === 'facturada' && (
              <Button size="sm" variant="ghost" onClick={handleAbrirCobro}>💰 Cobrar</Button>
            )}
            {cotizacion.estado === 'facturada' && (
              <Button size="sm" variant="ghost" onClick={handleAnularFactura} disabled={anulandoFactura} style={{ color: 'var(--color-danger, #dc2626)' }}>
                {anulandoFactura ? '...' : '🗑 Anular'}
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button size="sm" variant="ghost" onClick={handleEnviarWhatsApp} disabled={!cotizacion.contact?.phone || IRREVERSIBLES.includes(cotizacion.estado)}>📤 WhatsApp</Button>
            <Button size="sm" variant="ghost" onClick={handleDescargarPDF} disabled={IRREVERSIBLES.includes(cotizacion.estado)}>📥 PDF</Button>
          </div>
        </div>
      </div>

      {/* Proforma imprimible */}
      <div className="card" id="proforma" style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', margin: 0 }}>COTIZACIÓN</h1>
            <p className="meta" style={{ fontSize: '0.85rem' }}>N° {cotizacion.numero}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{companyName}</div>
            <div className="meta" style={{ fontSize: '0.78rem' }}>{pais === 'PY' ? 'RUC' : pais === 'AR' ? 'CUIT' : pais === 'CL' ? 'RUT' : pais === 'CO' ? 'NIT' : pais === 'PE' ? 'RUC' : pais === 'BR' ? 'CNPJ' : pais === 'MX' ? 'RFC' : 'RIF'}: {companyData.rif || '—'}</div>
            {companyData.direccion && <div className="meta" style={{ fontSize: '0.78rem' }}>{companyData.direccion}</div>}
            {companyData.telefono && <div className="meta" style={{ fontSize: '0.78rem' }}>Tel: {companyData.telefono}</div>}
            {companyData.email_empresa && <div className="meta" style={{ fontSize: '0.78rem' }}>{companyData.email_empresa}</div>}
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '2px solid var(--border)', marginBottom: 24 }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Cliente</div>
            <div>{cotizacion.contact?.name || '-'}</div>
            <div className="meta">{cotizacion.contact?.email || ''}</div>
            <div className="meta">{cotizacion.contact?.phone || ''}</div>
            <div className="meta">{cotizacion.contact?.organization?.name || ''}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Detalles</div>
            <div className="meta">Fecha: {cotizacion.created_at?.slice(0, 10)}</div>
            <div className="meta">Estado: {cotizacion.estado}</div>
          </div>
        </div>

        <table className="table" style={{ marginBottom: 24 }}>
          <thead>
            <tr>
              <th>Descripción</th>
              <th style={{ textAlign: 'right', width: 80 }}>Cant.</th>
              <th style={{ textAlign: 'right', width: 120 }}>Precio unit.</th>
              <th style={{ textAlign: 'right', width: 120 }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {cotizacion.items?.map((item) => (
              <tr key={item.id}>
                <td>{item.descripcion}</td>
                <td style={{ textAlign: 'right' }}>{Number(item.cantidad).toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{formatMoney(item.precio_unitario, cotizacion.moneda)}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(item.subtotal, cotizacion.moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ textAlign: 'right', fontSize: '1.1rem' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 400 }}>Subtotal: {formatMoney(cotizacion.subtotal, cotizacion.moneda)}</div>
          {cotizacion.impuesto > 0 && <div style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>IVA: +{formatMoney(cotizacion.impuesto, cotizacion.moneda)}</div>}
          {taxLines.length > 0 && taxLines.some((l) => l.tax?.is_withholding) && (
            <div style={{ fontSize: '0.9rem', fontWeight: 400, color: '#dc2626' }}>
              Retenciones: -{formatMoney(taxLines.filter((l) => l.tax?.is_withholding).reduce((s, l) => s + Number(l.tax_amount), 0), cotizacion.moneda)}
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: 4 }}>
            Total: {formatMoney(cotizacion.total, cotizacion.moneda)}
          </div>
        </div>

        {cotizacion.notas && (
          <div style={{ marginTop: 24, padding: 12, background: 'var(--bg-soft)', borderRadius: 6 }}>
            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.85rem' }}>Notas</div>
            <div className="meta" style={{ whiteSpace: 'pre-wrap', fontSize: '0.82rem' }}>{cotizacion.notas}</div>
          </div>
        )}
      </div>

      <style>{`
        @page {
          margin: 15mm;
          size: A4;
        }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          #proforma { box-shadow: none !important; border: none !important; padding: 0 !important; max-width: 100% !important; }
          .table th { background: #f3f4f6 !important; }
        }
      `}</style>

      {showFacturar && (
        <FacturarModal
          cotizacion={cotizacion}
          companyData={{ ...companyData, company_id: activeCompanyId, name: companyName }}
          onClose={() => setShowFacturar(false)}
          onFacturada={() => obtenerCotizacion(id).then(setCotizacion).catch(() => {})}
        />
      )}

      {/* Historial de cobros */}
      {cotizacion.estado !== 'borrador' && cotizacion.estado !== 'enviada' && (
        <div className="card">
          <div className="page-header" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>💰 Cobros registrados</h3>
            {cotizacion.estado === 'facturada' && (
              <Button size="sm" onClick={handleAbrirCobro}>+ Registrar cobro</Button>
            )}
          </div>
          {cobros.length === 0 ? (
            <p className="meta" style={{ padding: 16, textAlign: 'center' }}>Sin cobros registrados</p>
          ) : (
            <div className="table-wrapper">
              <table className="table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th>Medio</th>
                    <th>Cuenta</th>
                    <th>Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {cobros.map((c) => (
                    <tr key={c.id}>
                      <td className="meta">{c.fecha_cobro?.slice(0, 10)}</td>
                      <td style={{ fontWeight: 600, color: '#16a34a' }}>{formatMoney(c.monto, cotizacion.moneda)}</td>
                      <td>{c.medio_pago?.nombre || '—'}</td>
                      <td className="meta">{c.cuenta_banco ? `${c.cuenta_banco.code}` : '—'}</td>
                      <td className="meta">{c.referencia || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal cobro */}
      {showCobro && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => !cobrando && setShowCobro(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 420, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>💰 Registrar cobro</h3>
              <button onClick={() => setShowCobro(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <p className="meta" style={{ marginBottom: 12, fontSize: '0.85rem' }}>
              Cotización <strong>{cotizacion.numero}</strong> por <strong>{formatMoney(cotizacion.total, cotizacion.moneda)}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FormField label="Monto" type="number" min="0" step="0.01" value={cobroForm.monto} onChange={(e) => setCobroForm((prev) => ({ ...prev, monto: e.target.value }))} />
              <FormField label="Fecha de cobro" type="date" value={cobroForm.fecha_cobro} onChange={(e) => setCobroForm((prev) => ({ ...prev, fecha_cobro: e.target.value }))} />
              <FormField label="Medio de pago" as="select" value={cobroForm.medio_pago_id} onChange={(e) => setCobroForm((prev) => ({ ...prev, medio_pago_id: e.target.value }))}>
                <option value="">— Seleccionar —</option>
                {mediosPagoCobro.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </FormField>
              <FormField label="Cuenta bancaria / Caja" as="select" value={cobroForm.cuenta_banco_id} onChange={(e) => setCobroForm((prev) => ({ ...prev, cuenta_banco_id: e.target.value }))}>
                <option value="">— Seleccionar —</option>
                {cuentasCobro.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </FormField>
              <FormField label="Referencia" value={cobroForm.referencia} onChange={(e) => setCobroForm((prev) => ({ ...prev, referencia: e.target.value }))} placeholder="N° cheque / transferencia" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <Button variant="ghost" size="sm" onClick={() => setShowCobro(false)} disabled={cobrando}>Cancelar</Button>
              <Button size="sm" onClick={handleConfirmarCobro} disabled={cobrando || !cobroForm.monto || Number(cobroForm.monto) <= 0}>
                {cobrando ? 'Procesando...' : '✅ Confirmar cobro'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
