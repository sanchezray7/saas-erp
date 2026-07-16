import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, FormField, formatMoney, alertError, notify, MONEDA_POR_PAIS, getSupabase } from '@saas/core'
import { listarProveedores } from '../data/proveedores'
import { listarOrdenes } from '../data/ordenesCompra'
import { guardarFacturaProveedor, obtenerFacturaProveedor } from '../data/proveedorFacturas'
import { listarProductos } from '@saas/productos'
import { TaxSelector, guardarInvoiceTaxLines, listarInvoiceTaxLines, listarImpuestos } from '@saas/accounting'

export function FacturaProveedorFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeCompanyId, pais } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'PYG'
  const isEdit = Boolean(id)
  const [proveedores, setProveedores] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ proveedor_id: '', orden_id: '', numero_factura: '', timbrado: '', fecha_emision: new Date().toISOString().slice(0, 10), fecha_vencimiento: '', moneda, notas: '' })
  const [items, setItems] = useState([{ producto_id: '', orden_item_id: '', descripcion: '', cantidad: 1, precio_unitario: 0, iva_id: '' }])
  const [retenciones, setRetenciones] = useState([])
  const [ivaIncluido, setIvaIncluido] = useState(true)
  const [ivasDisponibles, setIvasDisponibles] = useState([])
  const [paymentTermsDays, setPaymentTermsDays] = useState(30)

  useEffect(() => {
    Promise.all([listarProveedores(activeCompanyId), listarOrdenes(activeCompanyId), listarProductos(activeCompanyId), listarImpuestos(activeCompanyId)])
      .then(([provs, ords, prods, taxes]) => {
        setProveedores(provs)
        setOrdenes(ords.filter((o) => o.estado === 'confirmada' || o.estado === 'recibida'))
        setProductos(prods)
        setIvasDisponibles(taxes.filter((t) => t.tax_group?.type === 'credito_fiscal'))
      }).catch(() => {})
    // Leer payment_terms_days de la empresa
    getSupabase().from('companies').select('payment_terms_days').eq('id', activeCompanyId).single()
      .then(({ data }) => {
        const days = data?.payment_terms_days || 30
        setPaymentTermsDays(days)
        if (!id) {
          const venc = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
          setForm((prev) => ({ ...prev, fecha_vencimiento: venc }))
        }
      }).catch(() => {})
    if (!isEdit) return
    obtenerFacturaProveedor(id).then((d) => {
      setForm({
        id: d.id, proveedor_id: d.proveedor_id, orden_id: d.orden_id || '',
        numero_factura: d.numero_factura, timbrado: d.timbrado || '',
        fecha_emision: d.fecha_emision?.slice(0, 10) || '', fecha_vencimiento: d.fecha_vencimiento?.slice(0, 10) || '',
        moneda: d.moneda, notas: d.notas || '',
      })
      listarInvoiceTaxLines('proveedor', d.id).then((lines) => {
        const rets = []
        lines.forEach((l) => {
          if (l.tax?.is_withholding) rets.push({ id: l.tax_id, name: l.tax?.name || '', percentage: l.tax?.percentage || 0, is_withholding: true, tax_group: l.tax?.tax_group || null })
        })
        setRetenciones(rets)
      }).catch(() => {})
      setItems(d.items?.map((i) => ({
        producto_id: i.producto_id || '', orden_item_id: i.orden_item_id || '',
        descripcion: i.descripcion || '', cantidad: Number(i.cantidad),
        precio_unitario: Number(i.precio_unitario), iva_id: i.iva_id || '',
      })) || [{ producto_id: '', orden_item_id: '', descripcion: '', cantidad: 1, precio_unitario: 0, iva_id: '' }])
      setLoading(false)
    }).catch((err) => { alertError('Error', err.message); setLoading(false) })
  }, [id, isEdit, activeCompanyId])

  function set(field, value) { setForm((prev) => ({ ...prev, [field]: value })) }

  function handleSelectProducto(idx, prodId) {
    const prod = productos.find((p) => p.id === prodId)
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, producto_id: prodId, descripcion: prod?.nombre || '',       precio_unitario: item.precio_unitario || Number(prod?.precio_compra || 0) } : item))
  }

  function updateItem(idx, field, value) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function addItem() { setItems((prev) => [...prev, { producto_id: '', orden_item_id: '', descripcion: '', cantidad: 1, precio_unitario: 0, iva_id: '' }]) }
  function removeItem(idx) { setItems((prev) => prev.filter((_, i) => i !== idx)) }

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
    if (!form.proveedor_id || items.length === 0) return
    setSubmitting(true)
    try {
      const facturaId = await guardarFacturaProveedor(activeCompanyId, { ...form, impuesto: totales.impuestos, total: totalFinal }, items)
      const taxItems = items.map((item, idx) => ({ item_id: idx, base_amount: Number(item.cantidad) * Number(item.precio_unitario), taxes: item.iva_id ? ivasDisponibles.filter((t) => t.id === item.iva_id) : [], iva_incluido: ivaIncluido }))
      taxItems.push({ item_id: null, base_amount: baseTotal, taxes: retenciones, iva_incluido: false })
      await guardarInvoiceTaxLines(activeCompanyId, 'proveedor', facturaId, taxItems)
      notify(isEdit ? 'Factura actualizada' : 'Factura registrada')
      navigate(`/facturas-proveedor/${facturaId}`)
    } catch (err) { alertError('Error', err.message) } finally { setSubmitting(false) }
  }

  if (loading) return <div className="card"><p className="meta">Cargando...</p></div>

  return (
    <div className="card">
      <div className="page-header">
        <h1>{isEdit ? `Editar ${form.numero_factura}` : 'Nueva factura de proveedor'}</h1>
        <Link to="/facturas-proveedor"><Button variant="ghost" size="sm">Volver</Button></Link>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Proveedor" as="select" required value={form.proveedor_id} onChange={(e) => set('proveedor_id', e.target.value)}>
            <option value="">— Seleccionar —</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </FormField>
          <FormField label="N° factura" required value={form.numero_factura} onChange={(e) => set('numero_factura', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Orden de compra" as="select" value={form.orden_id} onChange={(e) => set('orden_id', e.target.value)}>
            <option value="">— Sin OC —</option>
            {ordenes.map((o) => <option key={o.id} value={o.id}>{o.numero} - {o.proveedor?.nombre}</option>)}
          </FormField>
          <FormField label="Timbrado" value={form.timbrado} onChange={(e) => set('timbrado', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <FormField label="Fecha emisión" type="date" value={form.fecha_emision} onChange={(e) => set('fecha_emision', e.target.value)} />
          <FormField label="Fecha vencimiento" type="date" value={form.fecha_vencimiento} onChange={(e) => set('fecha_vencimiento', e.target.value)} />
          <FormField label="Moneda" as="select" value={form.moneda} onChange={(e) => set('moneda', e.target.value)}>
            <option value="PYG">PYG</option><option value="USD">USD</option><option value="BRL">BRL</option>
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
                <th style={{ width: '18%' }}>Producto</th>
                <th style={{ width: '18%' }}>Descripción</th>
                <th style={{ width: 55 }}>Cant.</th>
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
                    <td>
                      <select className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: '100%' }} value={item.producto_id} onChange={(e) => handleSelectProducto(idx, e.target.value)}>
                        <option value="">—</option>
                        {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </td>
                    <td><input className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: '100%' }} value={item.descripcion} onChange={(e) => updateItem(idx, 'descripcion', e.target.value)} placeholder="Descripción" /></td>
                    <td><input className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: 50 }} type="number" min="0.01" step="0.01" value={item.cantidad} onChange={(e) => updateItem(idx, 'cantidad', e.target.value)} /></td>
                    <td><input className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: 90 }} type="number" min="0" step="1" value={item.precio_unitario} onChange={(e) => updateItem(idx, 'precio_unitario', e.target.value)} /></td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(base, form.moneda)}</td>
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
            const ivaName = ivasDisponibles.find((t) => t.id === item.iva_id)?.name || 'Exenta'
            return (
              <div key={idx} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.82rem' }}>Item {idx + 1}</strong>
                  {items.length > 1 && <button type="button" onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>}
                </div>
                <select className="form-input" style={{ fontSize: '0.82rem' }} value={item.producto_id} onChange={(e) => handleSelectProducto(idx, e.target.value)}>
                  <option value="">— Producto —</option>
                  {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
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
                  <div style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.82rem' }}>Base: {formatMoney(base, form.moneda)}</div>
                </div>
              </div>
            )
          })}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={addItem}>+ Agregar item</Button>

        <div className="card" style={{ padding: 12, background: 'var(--bg-soft)', borderRadius: 6 }}>
          <h4 style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8 }}>⛔ Retenciones</h4>
          <TaxSelector companyId={activeCompanyId} selectedTaxes={retenciones} onChange={setRetenciones} baseAmount={baseTotal} moneda={form.moneda} context="proveedor" />
        </div>

        <div style={{ textAlign: 'right', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
          {ivaIncluido ? (
            <>
              <div style={{ fontSize: '0.9rem' }}>Total con IVA: {formatMoney(totales.subtotal, form.moneda)}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Base imponible: {formatMoney(baseTotal, form.moneda)}</div>
            </>
          ) : (
            <div style={{ fontSize: '0.9rem' }}>Subtotal: {formatMoney(totales.subtotal, form.moneda)}</div>
          )}
          {totales.impuestos > 0 && <div style={{ fontSize: '0.9rem' }}>IVA: +{formatMoney(totales.impuestos, form.moneda)}</div>}
          {retTotal > 0 && <div style={{ fontSize: '0.9rem', color: '#dc2626' }}>Retenciones: -{formatMoney(retTotal, form.moneda)}</div>}
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 4 }}>Total: {formatMoney(totalFinal, form.moneda)}</div>
        </div>

        <FormField label="Notas" as="textarea" rows={2} value={form.notas} onChange={(e) => set('notas', e.target.value)} />

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar'}</Button>
          <Link to="/facturas-proveedor"><Button variant="ghost">Cancelar</Button></Link>
        </div>
      </form>
    </div>
  )
}