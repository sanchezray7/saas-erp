import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, Button, FormField, alertError, notify } from '@saas/core'
import { listarContactos } from '@saas/crm'
import { guardarPresupuesto } from '../data/presupuestos'
import { QuickClientModal } from '../components/QuickClientModal'

export function PresupuestoFormPage() {
  const { activeCompanyId, user } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [contactos, setContactos] = useState([])
  const [showQuickClient, setShowQuickClient] = useState(false)
  const [items, setItems] = useState([{ descripcion: '', cantidad: 1, precio_unitario: 0, tipo: 'servicio' }])
  const [form, setForm] = useState({ cliente_id: '', contacto: '', direccion: '', fecha_emision: new Date().toISOString().split('T')[0], fecha_validez: '', notas: '' })

  useEffect(() => {
    if (!activeCompanyId) return
    listarContactos(activeCompanyId).then(setContactos).catch(() => {})
  }, [activeCompanyId])

  const subtotal = items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0), 0)

  function seleccionarCliente(e) {
    const id = e.target.value
    if (!id) { setForm({ ...form, cliente_id: '', contacto: '' }); return }
    const c = contactos.find((c) => c.id === id)
    setForm({ ...form, cliente_id: id, contacto: c?.name || '' })
  }

  function updItem(idx, field, value) {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function addItem() { setItems([...items, { descripcion: '', cantidad: 1, precio_unitario: 0, tipo: 'servicio' }]) }
  function removeItem(idx) { setItems(items.filter((_, i) => i !== idx)) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.contacto.trim()) { alertError('Error', 'Ingresá un cliente o contacto'); return }
    if (items.some((i) => !i.descripcion.trim())) { alertError('Error', 'Completá la descripción de todos los items'); return }
    setSubmitting(true)
    try {
      await guardarPresupuesto(activeCompanyId, user?.id, { ...form, items })
      notify('Presupuesto creado')
      navigate('/presupuestos')
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="card">
      <h1 style={{ marginBottom: 20 }}>📋 Nuevo presupuesto</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Cliente</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <select value={form.cliente_id} onChange={seleccionarCliente} style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.9rem', background: 'var(--color-surface)' }}>
                <option value="">— Seleccionar cliente —</option>
                {contactos.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
              </select>
              <button type="button" onClick={() => setShowQuickClient(true)} style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: '1rem' }} title="Nuevo cliente">➕</button>
            </div>
          </div>
          <FormField label="Dirección" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          <FormField label="Fecha emisión" type="date" value={form.fecha_emision} onChange={(e) => setForm({ ...form, fecha_emision: e.target.value })} />
          <FormField label="Fecha validez" type="date" value={form.fecha_validez} onChange={(e) => setForm({ ...form, fecha_validez: e.target.value })} />
        </div>

        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 8 }}>Items</h3>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={item.tipo} onChange={(e) => updItem(i, 'tipo', e.target.value)} style={{ width: 100, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>
              <option value="servicio">🔧 Servicio</option>
              <option value="repuesto">🔩 Repuesto</option>
              <option value="producto">📦 Producto</option>
            </select>
            <input value={item.descripcion} onChange={(e) => updItem(i, 'descripcion', e.target.value)} placeholder="Descripción" style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }} required />
            <input type="number" value={item.cantidad} onChange={(e) => updItem(i, 'cantidad', Number(e.target.value))} placeholder="Cant." style={{ width: 60, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }} min="1" />
            <input type="number" value={item.precio_unitario} onChange={(e) => updItem(i, 'precio_unitario', Number(e.target.value))} placeholder="$ Precio" style={{ width: 100, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }} min="0" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, width: 80, textAlign: 'right' }}>${(Number(item.cantidad) * Number(item.precio_unitario)).toLocaleString()}</span>
            {items.length > 1 && <button type="button" onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>×</button>}
          </div>
        ))}
        <button type="button" onClick={addItem} style={{ fontSize: '0.82rem', color: 'var(--color-accent)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, textAlign: 'left' }}>+ Agregar item</button>

        <div style={{ textAlign: 'right', fontSize: '1rem', fontWeight: 700, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
          Total: ${subtotal.toLocaleString()}
        </div>

        <FormField label="Notas" as="textarea" rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar presupuesto'}</Button>
          <button type="button" onClick={() => navigate('/presupuestos')} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)', cursor: 'pointer' }}>Cancelar</button>
        </div>
      </form>

      {showQuickClient && (
        <QuickClientModal
          onClose={() => setShowQuickClient(false)}
          onSaved={(contacto) => {
            setContactos((prev) => [...prev, contacto])
            setForm((prev) => ({ ...prev, cliente_id: contacto.id, contacto: contacto.name }))
          }}
        />
      )}
    </div>
  )
}
