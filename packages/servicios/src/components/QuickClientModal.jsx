import { useState } from 'react'
import { useAuth, Button, alertError, notify } from '@saas/core'
import { guardarContacto } from '@saas/crm'

export function QuickClientModal({ onClose, onSaved }) {
  const { activeCompanyId } = useAuth()
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [submitting, setSubmitting] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSubmitting(true)
    try {
      const data = await guardarContacto(activeCompanyId, { name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null })
      notify('Cliente creado')
      onSaved(data)
      onClose()
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>➕ Nuevo cliente</h3>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Nombre *</label>
          <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.9rem' }} required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Teléfono</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.9rem', marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.9rem', marginTop: 4 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)', cursor: 'pointer' }}>Cancelar</button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Creando...' : 'Crear cliente'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
