import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, FormField, formatMoney, alertError, notify, MONEDA_POR_PAIS } from '@saas/core'
import { listarContactos } from '../data/contacts'
import { listarDeals } from '../data/deals'
import { guardarCotizacion, obtenerCotizacion, generarNumero } from '../data/cotizaciones'
import { ProductoSelector } from '@saas/productos'
import { TaxSelector, guardarInvoiceTaxLines, listarInvoiceTaxLines, listarImpuestos } from '@saas/accounting'

export function CotizacionFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeCompanyId, pais } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'USD'
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [contacts, setContacts] = useState([])
  const [deals, setDeals] = useState([])
  const [numero, setNumero] = useState('')
  const [contactId, setContactId] = useState('')
  const [dealId, setDealId] = useState('')
  const [notas, setNotas] = useState('')
  const [estado, setEstado] = useState('borrador')
  const [items, setItems] = useState([{ descripcion: '', cantidad: 1, precio_unitario: 0, iva_id: '', account_venta_id: '', producto_id: '' }])
  const [retenciones, setRetenciones] = useState([])
  const [ivaIncluido, setIvaIncluido] = useState(true)
  const [ivasDisponibles, setIvasDisponibles] = useState([])

  useEffect(() => {
    Promise.all([
      listarContactos(activeCompanyId),
      listarDeals(activeCompanyId),
      !isEdit ? generarNumero(activeCompanyId) : Promise.resolve(null),
      listarImpuestos(activeCompanyId),
    ]).then(([c, d, num, taxes]) => {
      setContacts(c)
      setDeals(d || [])
      if (num) setNumero(num)
      setIvasDisponibles(taxes.filter((t) => t.tax_group?.type === 'debito_fiscal'))
    }).catch((err) => alertError('Error', err.message))

    if (!isEdit) return
    obtenerCotizacion(id)
      .then((data) => {
        setNumero(data.numero)
        setContactId(data.contact_id || '')
        setDealId(data.deal_id || '')
        setNotas(data.notas || '')
    setEstado(data.estado)
    setItems(data.items.length > 0
      ? data.items.map((i) => ({ descripcion: i.descripcion, cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario), iva_id: i.iva_id || '', account_venta_id: i.account_venta_id || '', producto_id: i.producto_id || '' }))
      : [{ descripcion: '', cantidad: 1, precio_unitario: 0, iva_id: '', account_venta_id: '', producto_id: '' }]
    )
    listarInvoiceTaxLines('cliente', data.id).then((lines) => {
      const rets = []
      lines.forEach((l) => {
        if (l.tax?.is_withholding) rets.push({ id: l.tax_id, name: l.tax?.name || '', percentage: l.tax?.percentage || 0, is_withholding: true, tax_group: l.tax?.tax_group || null })
      })
      setRetenciones(rets)
    }).catch(() => {})
      })
      .catch((err) => alertError('Error', err.message))
      .finally(() => setLoading(false))
  }, [id, isEdit, activeCompanyId])

  function updateItem(idx, field, value) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function addItem() { setItems((prev) => [...prev, { descripcion: '', cantidad: 1, precio_unitario: 0, iva_id: '', account_venta_id: '', producto_id: '' }]) }

  function removeItem(idx) { setItems((prev) => prev.filter((_, i) => i !== idx)) }

  function handleSelectProducto(producto) {
    setItems((prev) => [...prev, { descripcion: producto.descripcion || '', cantidad: producto.cantidad || 1,       precio_unitario: producto.precio_venta || 0, iva_id: '', account_venta_id: producto.account_venta_id || '', producto_id: producto.producto_id || '' }])
  }

  const totales = items.reduce((acc, item) => {
    const base = Number(item.cantidad) * Number(item.precio_unitario)
    const ivaTax = ivasDisponibles.find((t) => t.id === item.iva_id)
    let ivaMonto = 0
    if (ivaTax) { const p = Number(ivaTax.percentage) / 100; ivaMonto = ivaIncluido ? base - (base / (1 + p)) : base * p }
    acc.subtotal += base; acc.impuestos += ivaMonto
    return acc
  }, { subtotal: 0, impuestos: 0 })

  const baseTotal = ivaIncluido ? totales.subtotal - totales.impuestos : totales.subtotal
  const retTotal = retenciones.reduce((s, t) => s + baseTotal * (Number(t.percentage) / 100), 0)
  const totalFinal = ivaIncluido ? totales.subtotal - retTotal : totales.subtotal + totales.impuestos - retTotal

  async function handleSubmit(e) {
    e.preventDefault()
    const itemsValidos = items.filter((i) => i.descripcion.trim() && Number(i.cantidad) > 0)
    if (itemsValidos.length === 0) { alertError('Error', 'Agregá al menos un item'); return }
    setSubmitting(true)
    try {
      const cotizacionId = await guardarCotizacion(activeCompanyId, { id, numero, contact_id: contactId, deal_id: dealId, moneda, notas, estado, impuesto: totales.impuestos, total: totalFinal }, itemsValidos)
      const taxItems = items.map((item, idx) => ({ item_id: idx, base_amount: Number(item.cantidad) * Number(item.precio_unitario), taxes: item.iva_id ? ivasDisponibles.filter((t) => t.id === item.iva_id) : [], iva_incluido: ivaIncluido }))
      taxItems.push({ item_id: null, base_amount: baseTotal, taxes: retenciones, iva_incluido: false })
      await guardarInvoiceTaxLines(activeCompanyId, 'cliente', cotizacionId, taxItems)
      notify(isEdit ? t('common.actualizado') : t('common.guardado'))
      navigate(`/cotizaciones/${cotizacionId}`)
    } catch (err) { alertError('Error', err.message) } finally { setSubmitting(false) }
  }

  if (loading) return <div className="card"><p className="meta">Cargando...</p></div>

  return (
    <div className="card">
      <div className="page-header">
        <h1>{isEdit ? `Editar ${numero}` : 'Nueva cotización'}</h1>
        <Link to="/cotizaciones"><Button variant="ghost" size="sm">{t('common.volver')}</Button></Link>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="N°" value={numero} onChange={(e) => setNumero(e.target.value)} required />
          <FormField label="Moneda" as="select" value={moneda} disabled><option value={moneda}>{moneda}</option></FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Cliente" as="select" value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">— Seleccionar contacto —</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>)}
          </FormField>
          <FormField label="Oportunidad (opcional)" as="select" value={dealId} onChange={(e) => setDealId(e.target.value)}>
            <option value="">—</option>
            {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Estado" as="select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="borrador">Borrador</option>
            <option value="enviada">Enviada</option>
            <option value="aceptada">Aceptada</option>
            <option value="rechazada">Rechazada</option>
          </FormField>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Items</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={ivaIncluido} onChange={(e) => setIvaIncluido(e.target.checked)} /> IVA incluido en precios
          </label>
        </div>

        <div className="items-table-desktop">
          <table className="table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ width: '34%' }}>Descripción</th>
                <th style={{ width: 60 }}>Cant.</th>
                <th style={{ width: 100 }}>Precio</th>
                <th style={{ width: 90 }}>Base</th>
                <th style={{ width: 90 }}>IVA</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const base = Number(item.cantidad) * Number(item.precio_unitario)
                return (
                  <tr key={idx}>
                    <td><input className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: '100%' }} value={item.descripcion} onChange={(e) => updateItem(idx, 'descripcion', e.target.value)} placeholder="Ej: Consultoría mensual" /></td>
                    <td><input className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: 55 }} type="number" min="0.01" step="0.01" value={item.cantidad} onChange={(e) => updateItem(idx, 'cantidad', e.target.value)} /></td>
                    <td><input className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: 90 }} type="number" min="0" step="1" value={item.precio_unitario} onChange={(e) => updateItem(idx, 'precio_unitario', e.target.value)} /></td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(base, moneda)}</td>
                    <td>
                      <select className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: '100%' }} value={item.iva_id} onChange={(e) => updateItem(idx, 'iva_id', e.target.value)}>
                        <option value="">Exenta</option>
                        {ivasDisponibles.map((t) => <option key={t.id} value={t.id}>{t.name} ({Number(t.percentage).toFixed(0)}%)</option>)}
                      </select>
                    </td>
                    <td>{items.length > 1 && <button type="button" onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="items-table-mobile">
          {items.map((item, idx) => {
            const base = Number(item.cantidad) * Number(item.precio_unitario)
            return (
              <div key={idx} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.82rem' }}>Item {idx + 1}</strong>
                  {items.length > 1 && <button type="button" onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>}
                </div>
                <input className="form-input" style={{ fontSize: '0.82rem' }} value={item.descripcion} onChange={(e) => updateItem(idx, 'descripcion', e.target.value)} placeholder="Descripción" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input className="form-input" style={{ fontSize: '0.82rem' }} type="number" min="0.01" step="0.01" value={item.cantidad} onChange={(e) => updateItem(idx, 'cantidad', e.target.value)} placeholder="Cant." />
                  <input className="form-input" style={{ fontSize: '0.82rem' }} type="number" min="0" step="1" value={item.precio_unitario} onChange={(e) => updateItem(idx, 'precio_unitario', e.target.value)} placeholder="Precio" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center' }}>
                  <select className="form-input" style={{ fontSize: '0.82rem' }} value={item.iva_id} onChange={(e) => updateItem(idx, 'iva_id', e.target.value)}>
                    <option value="">Exenta</option>
                    {ivasDisponibles.map((t) => <option key={t.id} value={t.id}>{t.name} ({Number(t.percentage).toFixed(0)}%)</option>)}
                  </select>
                  <div style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.82rem' }}>Base: {formatMoney(base, moneda)}</div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Button type="button" variant="ghost" size="sm" onClick={addItem}>+ Agregar item</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowProductSelector(true)}>📦 Del catálogo</Button>
        </div>

        <div className="card" style={{ padding: 12, background: 'var(--bg-soft)', borderRadius: 6 }}>
          <h4 style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8 }}>⛔ Retenciones</h4>
          <TaxSelector companyId={activeCompanyId} selectedTaxes={retenciones} onChange={setRetenciones} baseAmount={baseTotal} moneda={moneda} context="cliente" />
        </div>

        <div style={{ textAlign: 'right', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
          {ivaIncluido ? (
            <>
              <div style={{ fontSize: '0.9rem' }}>Total con IVA: {formatMoney(totales.subtotal, moneda)}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Base imponible: {formatMoney(baseTotal, moneda)}</div>
            </>
          ) : (
            <div style={{ fontSize: '0.9rem' }}>Subtotal: {formatMoney(totales.subtotal, moneda)}</div>
          )}
          {totales.impuestos > 0 && <div style={{ fontSize: '0.9rem' }}>IVA: +{formatMoney(totales.impuestos, moneda)}</div>}
          {retTotal > 0 && <div style={{ fontSize: '0.9rem', color: '#dc2626' }}>Retenciones: -{formatMoney(retTotal, moneda)}</div>}
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 4 }}>Total: {formatMoney(totalFinal, moneda)}</div>
        </div>

        <FormField label="Notas (opcional)" as="textarea" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Condiciones de pago, validez, etc." />

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={submitting}>{submitting ? t('common.guardando') : t('common.guardar')}</Button>
          <Link to="/cotizaciones"><Button variant="ghost">{t('common.cancelar')}</Button></Link>
        </div>
      </form>

      {showProductSelector && (
        <ProductoSelector companyId={activeCompanyId} onSelect={handleSelectProducto} onClose={() => setShowProductSelector(false)} />
      )}
    </div>
  )
}