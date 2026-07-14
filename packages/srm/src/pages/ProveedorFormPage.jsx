import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, FormField, Button, notify, alertError } from '@saas/core'
import { guardarProveedor, obtenerProveedor } from '../data/proveedores'
import { listarContactos } from '@saas/crm'
import { listarAccounts } from '@saas/accounting'

export function ProveedorFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeCompanyId } = useAuth()
  const isEdit = Boolean(id)
  const [contacts, setContacts] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    nombre: '', ruc: '', email: '', telefono: '', direccion: '', sitio_web: '', categoria: '', contact_id: '', estado: 'activo', account_proveedor_id: '',
  })

  function set(field, value) { setForm((prev) => ({ ...prev, [field]: value })) }

  useEffect(() => {
    Promise.all([listarContactos(activeCompanyId), listarAccounts(activeCompanyId)]).then(([c, a]) => { setContacts(c); setAccounts(a.filter((acc) => acc.type === 'pasivo')) }).catch(() => {})
    if (!isEdit) return
    obtenerProveedor(id).then((d) => {
      setForm({
        nombre: d.nombre || '', ruc: d.ruc || '', email: d.email || '', telefono: d.telefono || '',
        direccion: d.direccion || '', sitio_web: d.sitio_web || '', categoria: d.categoria || '',
        contact_id: d.contact_id || '', estado: d.estado || 'activo', account_proveedor_id: d.account_proveedor_id || '',
      })
      setLoading(false)
    }).catch((err) => { alertError('Error', err.message); setLoading(false) })
  }, [id, isEdit, activeCompanyId])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setSubmitting(true)
    try {
      await guardarProveedor(activeCompanyId, { id: isEdit ? id : null, ...form })
      notify(isEdit ? 'Proveedor actualizado' : 'Proveedor creado')
      navigate('/proveedores')
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="card"><p className="meta">Cargando...</p></div>

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="page-header">
        <h1>{isEdit ? 'Editar proveedor' : 'Nuevo proveedor'}</h1>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Nombre" required value={form.nombre} onChange={(e) => set('nombre', e.target.value)} autoFocus />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="RUC" value={form.ruc} onChange={(e) => set('ruc', e.target.value)} />
          <FormField label="Categoría" value={form.categoria} onChange={(e) => set('categoria', e.target.value)} placeholder="Ej: Insumos, Servicios" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          <FormField label="Teléfono" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
        </div>
        <FormField label="Dirección" value={form.direccion} onChange={(e) => set('direccion', e.target.value)} />
        <FormField label="Sitio web" value={form.sitio_web} onChange={(e) => set('sitio_web', e.target.value)} />
        <FormField label="Vincular a contacto" as="select" value={form.contact_id} onChange={(e) => set('contact_id', e.target.value)}>
          <option value="">— Sin vínculo —</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>)}
        </FormField>
        <FormField label="Estado" as="select" value={form.estado} onChange={(e) => set('estado', e.target.value)}>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </FormField>
        <FormField label="Cuenta contable (proveedor)" as="select" value={form.account_proveedor_id} onChange={(e) => set('account_proveedor_id', e.target.value)}>
          <option value="">— Por defecto (2.1.1 Proveedores) —</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
        </FormField>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button type="submit" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar'}</Button>
          <Link to="/proveedores"><Button variant="ghost">Cancelar</Button></Link>
        </div>
      </form>
    </div>
  )
}
