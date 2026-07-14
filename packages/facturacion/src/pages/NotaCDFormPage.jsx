import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth, Button, FormField, Skeleton, formatMoney, alertError, notify, getSupabase, MONEDA_POR_PAIS } from '@saas/core'
import { guardarNota } from '../data/notasCD'

export function NotaCDFormPage() {
  const navigate = useNavigate()
  const { activeCompanyId, user, pais } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'PYG'
  const supabase = getSupabase()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [facturas, setFacturas] = useState([])
  const [facturaSel, setFacturaSel] = useState(null)
  const [form, setForm] = useState({
    factura_origen_id: '', tipo: 'credito', motivo: '',
    items: [], impuesto: 0,
  })

  useEffect(() => {
    supabase.from('facturas').select('id, numero, cdc, total, moneda, cotizacion_id, cotizacion:cotizacion_id(contact:contact_id(name))')
      .eq('company_id', activeCompanyId).in('estado', ['aprobada', 'cobrada']).order('created_at', { ascending: false })
      .then(({ data }) => { setFacturas(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [activeCompanyId, supabase])

  function handleSelectFactura(id) {
    const f = facturas.find((fa) => fa.id === id)
    setFacturaSel(f || null)
    if (!f) {
      setForm((prev) => ({ ...prev, factura_origen_id: '', items: [], subtotal: 0, impuesto: 0, total: 0 }))
      return
    }
    // Cargar items de la cotización vinculada a la factura
    supabase.from('cotizacion_items').select('descripcion, cantidad, precio_unitario, producto:producto_id(nombre)')
      .eq('cotizacion_id', f.cotizacion_id).order('id')
      .then(({ data: items }) => {
        const mapped = (items || []).map((i) => ({
          descripcion: i.producto?.nombre || i.descripcion || 'Item',
          cantidad: Number(i.cantidad),
          precioUnitario: Number(i.precio_unitario),
          tasaIVA: 10, montoIVA: 0,
        }))
        // Si no hay items en la cotización, usar un item genérico con el total
        if (mapped.length === 0) {
          mapped.push({ descripcion: 'Items factura ' + (f.numero || ''), cantidad: 1, precioUnitario: Number(f.total), tasaIVA: 10, montoIVA: 0 })
        }
        const subtotal = mapped.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0)
        setForm((prev) => ({ ...prev, factura_origen_id: id, items: mapped, subtotal, impuesto: 0, total: subtotal }))
      }).catch(() => {
        setForm((prev) => ({ ...prev, factura_origen_id: id, items: [{ descripcion: 'Items factura ' + (f.numero || ''), cantidad: 1, precioUnitario: Number(f.total), tasaIVA: 10, montoIVA: 0 }], subtotal: Number(f.total), impuesto: 0, total: Number(f.total) }))
      })
  }

  function handleItemChange(idx, field, value) {
    setForm((prev) => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: value }
      const subtotal = items.reduce((s, i) => s + Number(i.cantidad || 0) * Number(i.precioUnitario || 0), 0)
      return { ...prev, items, subtotal, total: subtotal + Number(prev.impuesto || 0) }
    })
  }

  function addItem() {
    setForm((prev) => ({ ...prev, items: [...prev.items, { descripcion: '', cantidad: 1, precioUnitario: 0, tasaIVA: 10, montoIVA: 0 }] }))
  }

  function removeItem(idx) {
    setForm((prev) => {
      const items = prev.items.filter((_, i) => i !== idx)
      return { ...prev, items }
    })
  }

  async function handleSubmit() {
    if (!form.factura_origen_id) { alertError('Error', 'Seleccioná una factura origen'); return }
    if (!form.motivo.trim()) { alertError('Error', 'Ingresá un motivo'); return }
    if (form.items.length === 0) { alertError('Error', 'Agregá al menos un item'); return }
    setSubmitting(true)
    try {
      const id = await guardarNota(activeCompanyId, user?.id, form)
      notify('Nota guardada como borrador')
      navigate(`/notas-cd/${id}`)
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  if (loading) return <Skeleton.Card />

  const subtotal = form.items.reduce((s, i) => s + Number(i.cantidad || 0) * Number(i.precioUnitario || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📝 Nueva Nota de {form.tipo === 'credito' ? 'Crédito' : 'Débito'}</h1>
          <Link to="/notas-cd"><Button variant="ghost" size="sm">Volver</Button></Link>
        </div>

        <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16, maxWidth: 600 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Tipo" as="select" value={form.tipo} onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value }))}>
              <option value="credito">🧾 Nota de Crédito</option>
              <option value="debito">📈 Nota de Débito</option>
            </FormField>
            <FormField label="Factura origen" as="select" value={form.factura_origen_id} onChange={(e) => handleSelectFactura(e.target.value)}>
              <option value="">— Seleccionar factura —</option>
              {facturas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.numero} - {f.cotizacion?.contact?.name || '—'} ({formatMoney(f.total, f.moneda)})
                </option>
              ))}
            </FormField>
          </div>

          {facturaSel && (
            <div style={{ padding: 12, background: 'var(--bg-soft)', borderRadius: 6 }}>
              <div className="meta" style={{ fontSize: '0.78rem' }}>Factura seleccionada:</div>
              <div style={{ fontWeight: 600 }}>{facturaSel.numero} — {formatMoney(facturaSel.total, facturaSel.moneda)}</div>
              <div className="meta">CDC: {facturaSel.cdc || '—'}</div>
            </div>
          )}

          <FormField label="Motivo (obligatorio)" required value={form.motivo} onChange={(e) => setForm((prev) => ({ ...prev, motivo: e.target.value }))}
            placeholder={form.tipo === 'credito' ? 'Ej: Devolución de mercadería' : 'Ej: Interés por mora'} />

          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '8px 0 0' }}>Items</h3>

          {form.items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: 150 }}>
                <FormField label={idx === 0 ? 'Descripción' : ''} value={item.descripcion} onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)} placeholder="Descripción" />
              </div>
              <div style={{ width: 80 }}>
                <FormField label={idx === 0 ? 'Cant.' : ''} type="number" min="1" value={item.cantidad} onChange={(e) => handleItemChange(idx, 'cantidad', Number(e.target.value))} />
              </div>
              <div style={{ width: 110 }}>
                <FormField label={idx === 0 ? 'Precio' : ''} type="number" min="0" step="0.01" value={item.precioUnitario} onChange={(e) => handleItemChange(idx, 'precioUnitario', Number(e.target.value))} />
              </div>
              <div style={{ width: 80 }}>
                <FormField label={idx === 0 ? 'IVA %' : ''} type="number" min="0" value={item.tasaIVA} onChange={(e) => handleItemChange(idx, 'tasaIVA', Number(e.target.value))} />
              </div>
              {form.items.length > 1 && (
                <button type="button" onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '1.2rem', paddingBottom: idx === 0 ? 4 : 0 }}>✕</button>
              )}
            </div>
          ))}

          <Button type="button" variant="ghost" size="sm" onClick={addItem}>+ Agregar item</Button>

          <div style={{ textAlign: 'right', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
            <div style={{ fontSize: '0.9rem' }}>Subtotal: {formatMoney(subtotal, moneda)}</div>
            <div style={{ fontSize: '0.9rem' }}>IVA: {formatMoney(form.impuesto || 0, moneda)}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Total: {formatMoney(subtotal + Number(form.impuesto || 0), moneda)}</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="submit" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Guardando...' : '💾 Guardar borrador'}
            </Button>
            <Link to="/notas-cd"><Button variant="ghost">Cancelar</Button></Link>
          </div>
        </form>
      </div>
    </div>
  )
}
