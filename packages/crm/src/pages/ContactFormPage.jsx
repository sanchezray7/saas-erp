import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, FormField, Button, notify, alertError, getSupabase } from '@saas/core'
import { guardarContacto, obtenerContacto } from '../data/contacts'
import { listarOrganizaciones } from '../data/organizations'
import { listarRouting } from '../data/roundRobin'
import { TagInput } from '../components/TagInput'
import { listarTagsDeContacto } from '../data/tags'
import { listarAccounts } from '@saas/accounting'

const TIPOS_DOC = [
  { value: '', label: 'RUC' },
  { value: 1, label: 'Cédula paraguaya' },
  { value: 2, label: 'Pasaporte' },
  { value: 3, label: 'Cédula extranjera' },
  { value: 4, label: 'Carnet de residencia' },
]

export function ContactFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeCompanyId } = useAuth()
  const isEdit = Boolean(id)
  const [orgs, setOrgs] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [selectedTags, setSelectedTags] = useState([])
  const [accounts, setAccounts] = useState([])
  const contactIdRef = useRef(null)
  const [form, setForm] = useState({
    id: null, name: '', email: '', phone: '', position: '',
    organization_id: '', source: '', notes: '', assigned_to: '',
    ruc: '', dv: '', tipo_documento: '', num_documento: '', pais: 'PRY', direccion: '',
    account_cliente_id: '',
  })

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    async function init() {
      try {
        const [orgsData, routingData, accs] = await Promise.all([
          listarOrganizaciones(activeCompanyId),
          listarRouting(activeCompanyId),
          listarAccounts(activeCompanyId),
        ])
        setOrgs(orgsData)
        setVendedores(routingData.filter((r) => r.activo))
        setAccounts(accs.filter((a) => a.type === 'activo'))
      } catch (err) {
        console.warn('[init]', err.message)
      }
    }
    init()
    if (!isEdit) return
    obtenerContacto(id)
      .then((data) => {
        setForm({
          id: data.id, name: data.name || '', email: data.email || '', phone: data.phone || '',
          position: data.position || '', organization_id: data.organization_id || '',
          source: data.source || '', notes: data.notes || '', assigned_to: data.assigned_to?.id || '',
          ruc: data.ruc || '', dv: data.dv || '', tipo_documento: data.tipo_documento ?? '',
          num_documento: data.num_documento || '', pais: data.pais || 'PRY', direccion: data.direccion || '',
          account_cliente_id: data.account_cliente_id || '',
        })
        contactIdRef.current = data.id
        listarTagsDeContacto(id).then(setSelectedTags).catch(() => {})
        setLoading(false)
      })
      .catch((err) => { alertError('Error', err.message); setLoading(false) })
  }, [id, isEdit, activeCompanyId])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const saved = await guardarContacto(activeCompanyId, form)
      const supabase = getSupabase()

      // TEST: mostrar cuántas tags hay
      if (selectedTags.length === 0) {
        notify('Contacto guardado. No había tags para vincular.')
        navigate('/contacts')
        return
      }

      // Insertar tags
      const { error } = await supabase.from('contact_tags').insert(
        selectedTags.map((tag) => ({ contact_id: saved.id, tag_id: tag.id }))
      )

      if (error) {
        notify('Error al guardar tags: ' + error.message)
      } else {
        notify('Contacto y ' + selectedTags.length + ' tag(s) guardados correctamente')
      }
      navigate('/contacts')
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="card" style={{ maxWidth: 560 }}><p className="meta">Cargando...</p></div>

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="page-header">
        <h1>{isEdit ? t('contacts.editar') : t('contacts.nuevo')}</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label={t('contacts.nombre')} required value={form.name} onChange={(e) => set('name', e.target.value)} />
        <FormField label={t('contacts.email')} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        <FormField label={t('contacts.telefono')} value={form.phone} onChange={(e) => set('phone', e.target.value)} />

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />
        <h4 style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0 }}>📋 Documentación fiscal</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 8 }}>
          <FormField label="RUC" value={form.ruc} onChange={(e) => set('ruc', e.target.value)} placeholder="Solo si tiene RUC" />
          <FormField label="DV" value={form.dv} onChange={(e) => set('dv', e.target.value)} placeholder="DV" />
        </div>
        {!form.ruc && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FormField label="Tipo documento" as="select" value={form.tipo_documento} onChange={(e) => set('tipo_documento', e.target.value)}>
              {TIPOS_DOC.map((td) => <option key={td.value} value={td.value}>{td.label}</option>)}
            </FormField>
            <FormField label="N° documento" value={form.num_documento} onChange={(e) => set('num_documento', e.target.value)} placeholder="Ej: 1234567" />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <FormField label="País" as="select" value={form.pais} onChange={(e) => set('pais', e.target.value)}>
            <option value="PRY">🇵🇾 Paraguay</option>
            <option value="ARG">🇦🇷 Argentina</option>
            <option value="BRA">🇧🇷 Brasil</option>
            <option value="CHL">🇨🇱 Chile</option>
            <option value="COL">🇨🇴 Colombia</option>
            <option value="PER">🇵🇪 Perú</option>
            <option value="URY">🇺🇾 Uruguay</option>
            <option value="BOL">🇧🇴 Bolivia</option>
            <option value="ECU">🇪🇨 Ecuador</option>
            <option value="VEN">🇻🇪 Venezuela</option>
            <option value="MEX">🇲🇽 México</option>
            <option value="USA">🇺🇸 Estados Unidos</option>
            <option value="ESP">🇪🇸 España</option>
            <option value="OTRO">Otro</option>
          </FormField>
          <FormField label="Dirección" value={form.direccion} onChange={(e) => set('direccion', e.target.value)} />
        </div>

        <FormField label={t('contacts.cargo')} value={form.position} onChange={(e) => set('position', e.target.value)} />
        <FormField label={t('contacts.empresa')} as="select" value={form.organization_id} onChange={(e) => set('organization_id', e.target.value)}>
          <option value="">—</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </FormField>
        <FormField label={t('contacts.origen')} value={form.source} onChange={(e) => set('source', e.target.value)} />
        <FormField label={t('contacts.notas')} as="textarea" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />

        <FormField label="Cuenta contable (cliente)" as="select" value={form.account_cliente_id} onChange={(e) => set('account_cliente_id', e.target.value)}>
          <option value="">— Por defecto (1.1.3 Clientes) —</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
        </FormField>

        {/* TagInput dentro del form pero con stopPropagation en keydown */}
        <div onKeyDown={(e) => e.stopPropagation()}>
          <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>🏷️ Etiquetas</label>
          <TagInput
            companyId={activeCompanyId}
            contactId={null}
            selectedTags={selectedTags}
            onChange={setSelectedTags}
          />
        </div>

        {vendedores.length > 0 && (
          <FormField label={t('contacts.asignadoA')} as="select" value={form.assigned_to} onChange={(e) => set('assigned_to', e.target.value)}>
            <option value="">{t('contacts.asignarAutomatico')}</option>
            {vendedores.map((v) => (
              <option key={v.user_id} value={v.user_id}>{v.email || v.user_id}</option>
            ))}
          </FormField>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button type="submit" disabled={submitting}>{submitting ? t('common.guardando') : t('common.guardar')}</Button>
          <Button variant="ghost" onClick={() => navigate('/contacts')}>{t('common.cancelar')}</Button>
        </div>
      </form>
    </div>
  )
}
