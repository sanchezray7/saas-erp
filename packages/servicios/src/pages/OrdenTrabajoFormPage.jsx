import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, Button, FormField, alertError, notify } from '@saas/core'
import { guardarOrdenTrabajo } from '../data/ordenes'

export function OrdenTrabajoFormPage() {
  const { activeCompanyId, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    presupuesto_id: searchParams.get('presupuesto_id') || null,
    titulo: '', cliente_id: null, contacto: '', direccion: '',
    prioridad: 'normal', fecha_estimada: '', horas_estimadas: '',
    costo_estimado: '', descripcion: '', notas_internas: '', notas_cliente: '',
  })

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.titulo.trim()) { alertError('Error', 'Ingresá un título'); return }
    setSubmitting(true)
    try {
      await guardarOrdenTrabajo(activeCompanyId, user?.id, form)
      notify('Orden de trabajo creada')
      navigate('/ordenes-trabajo')
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="card">
      <h1 style={{ marginBottom: 20 }}>⚡ Nueva orden de trabajo</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label="Título" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <FormField label="Contacto cliente" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
          <FormField label="Dirección" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          <FormField label="Prioridad" as="select" value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })}>
            <option value="baja">🟢 Baja</option>
            <option value="normal">🔵 Normal</option>
            <option value="alta">🟠 Alta</option>
            <option value="urgente">🔴 Urgente</option>
          </FormField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <FormField label="Fecha estimada" type="date" value={form.fecha_estimada} onChange={(e) => setForm({ ...form, fecha_estimada: e.target.value })} />
          <FormField label="Horas estimadas" type="number" value={form.horas_estimadas} onChange={(e) => setForm({ ...form, horas_estimadas: e.target.value })} />
          <FormField label="Costo estimado" type="number" value={form.costo_estimado} onChange={(e) => setForm({ ...form, costo_estimado: e.target.value })} />
        </div>
        <FormField label="Descripción" as="textarea" rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        <FormField label="Notas internas" as="textarea" rows={2} value={form.notas_internas} onChange={(e) => setForm({ ...form, notas_internas: e.target.value })} />
        <FormField label="Notas para el cliente" as="textarea" rows={2} value={form.notas_cliente} onChange={(e) => setForm({ ...form, notas_cliente: e.target.value })} />

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={submitting}>{submitting ? 'Creando...' : 'Crear OT'}</Button>
          <button type="button" onClick={() => navigate('/ordenes-trabajo')} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)', cursor: 'pointer' }}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}
