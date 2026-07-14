import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, FormField, alertError, notify, MONEDA_POR_PAIS } from '@saas/core'
import { listarProveedores } from '../data/proveedores'
import { guardarOrden, obtenerOrden } from '../data/ordenesCompra'
import { listarProductos } from '@saas/productos'

export function OrdenCompraFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeCompanyId, pais } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'PYG'
  const isEdit = Boolean(id)
  const [proveedores, setProveedores] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ proveedor_id: '', numero: '', fecha_entrega_estimada: '', notas: '', moneda })
  const [items, setItems] = useState([{ producto_id: '', descripcion: '', cantidad: 1, precio_unitario: 0 }])

  useEffect(() => {
    Promise.all([listarProveedores(activeCompanyId), listarProductos(activeCompanyId)]).then(([provs, prods]) => {
      setProveedores(provs)
      setProductos(prods)
    }).catch(() => {})
    if (!isEdit) {
      setForm((prev) => ({ ...prev, numero: 'OC-' + Date.now().toString(36).toUpperCase() }))
      return
    }
    obtenerOrden(id).then((d) => {
      setForm({ id: d.id, proveedor_id: d.proveedor_id, numero: d.numero, fecha_entrega_estimada: d.fecha_entrega_estimada?.slice(0, 10) || '', notas: d.notas || '', moneda: d.moneda })
      setItems(d.items?.map((i) => ({ producto_id: i.producto_id, descripcion: i.descripcion || '', cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario) })) || [{ producto_id: '', descripcion: '', cantidad: 1, precio_unitario: 0 }])
      setLoading(false)
    }).catch((err) => { alertError('Error', err.message); setLoading(false) })
  }, [id, isEdit, activeCompanyId])

  function set(field, value) { setForm((prev) => ({ ...prev, [field]: value })) }

  function handleSelectProducto(idx, prodId) {
    const prod = productos.find((p) => p.id === prodId)
    setItems((prev) => prev.map((item, i) => i === idx ? {
      producto_id: prodId,
      descripcion: prod?.nombre || '',
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario || Number(prod?.precio_unitario || 0),
    } : item))
  }

  function updateItem(idx, field, value) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function addItem() { setItems((prev) => [...prev, { producto_id: '', descripcion: '', cantidad: 1, precio_unitario: 0 }]) }
  function removeItem(idx) { setItems((prev) => prev.filter((_, i) => i !== idx)) }
  function calcularTotal() { return items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.proveedor_id || items.length === 0) return
    setSubmitting(true)
    try {
      const ordenId = await guardarOrden(activeCompanyId, form, items)
      notify(isEdit ? 'Orden actualizada' : 'Orden creada')
      navigate(`/ordenes-compra/${ordenId}`)
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="card"><p className="meta">Cargando...</p></div>

  return (
    <div className="card">
      <div className="page-header">
        <h1>{isEdit ? `Editar ${form.numero}` : 'Nueva orden de compra'}</h1>
        <Link to="/ordenes-compra"><Button variant="ghost" size="sm">Volver</Button></Link>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Proveedor" as="select" required value={form.proveedor_id} onChange={(e) => set('proveedor_id', e.target.value)}>
            <option value="">— Seleccionar —</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </FormField>
          <FormField label="N° orden" value={form.numero} onChange={(e) => set('numero', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Fecha entrega estimada" type="date" value={form.fecha_entrega_estimada} onChange={(e) => set('fecha_entrega_estimada', e.target.value)} />
          <FormField label="Moneda" as="select" value={form.moneda} onChange={(e) => set('moneda', e.target.value)}>
            <option value="PYG">PYG</option><option value="USD">USD</option><option value="BRL">BRL</option>
          </FormField>
        </div>

        <div>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8 }}>Items</h3>
          <table className="table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Producto</th>
                <th style={{ width: '30%' }}>Descripción</th>
                <th style={{ width: 80 }}>Cantidad</th>
                <th style={{ width: 120 }}>Precio</th>
                <th style={{ width: 100 }}>Subtotal</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <select className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: '100%' }} value={item.producto_id} onChange={(e) => handleSelectProducto(idx, e.target.value)}>
                      <option value="">—</option>
                      {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </td>
                  <td><input className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: '100%' }} value={item.descripcion} onChange={(e) => updateItem(idx, 'descripcion', e.target.value)} /></td>
                  <td><input className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: 70 }} type="number" min="0.01" step="0.01" value={item.cantidad} onChange={(e) => updateItem(idx, 'cantidad', e.target.value)} /></td>
                  <td><input className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: 110 }} type="number" min="0" step="1" value={item.precio_unitario} onChange={(e) => updateItem(idx, 'precio_unitario', e.target.value)} /></td>
                  <td style={{ fontWeight: 600 }}>{(Number(item.cantidad) * Number(item.precio_unitario)).toLocaleString()}</td>
                  <td>{items.length > 1 && <button type="button" onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button type="button" variant="ghost" size="sm" onClick={addItem} style={{ marginTop: 8 }}>+ Agregar item</Button>
        </div>

        <div style={{ textAlign: 'right', fontSize: '1.1rem', fontWeight: 700 }}>Total: {calcularTotal().toLocaleString()} {form.moneda}</div>

        <FormField label="Notas" as="textarea" rows={2} value={form.notas} onChange={(e) => set('notas', e.target.value)} />

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar'}</Button>
          <Link to="/ordenes-compra"><Button variant="ghost">Cancelar</Button></Link>
        </div>
      </form>
    </div>
  )
}
