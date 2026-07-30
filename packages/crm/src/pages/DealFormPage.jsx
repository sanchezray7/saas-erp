import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, FormField, Button, notify, alertError } from '@saas/core'
import { guardarDeal, obtenerDeal } from '../data/deals'
import { listarPipelines } from '../data/pipelines'
import { listarContactos } from '../data/contacts'
import { listarOrganizaciones } from '../data/organizations'

export function DealFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeCompanyId, user } = useAuth()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [pipelines, setPipelines] = useState([])
  const [contacts, setContacts] = useState([])
  const [orgs, setOrgs] = useState([])
  const [form, setForm] = useState({ title: '', value: '', pipeline_id: '', stage_id: '', contact_id: '', organization_id: '', expected_close_date: '', probability: '', notes: '' })

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    Promise.all([
      listarPipelines(activeCompanyId),
      listarContactos(activeCompanyId),
      listarOrganizaciones(activeCompanyId),
    ]).then(([p, c, o]) => {
      setPipelines(p)
      setContacts(c)
      setOrgs(o)
      if (!isEdit && p.length > 0) {
        const firstPipeline = p[0]
        setForm((prev) => ({ ...prev, pipeline_id: firstPipeline.id, stage_id: firstPipeline.stages?.[0]?.id || '' }))
      }
    }).catch(() => {})

    if (!isEdit) return
    obtenerDeal(id)
      .then((data) => {
        setForm({
          title: data.title || '',
          value: data.value?.toString() || '',
          pipeline_id: data.pipeline_id || '',
          stage_id: data.stage_id || '',
          contact_id: data.contact_id || '',
          organization_id: data.organization_id || '',
          expected_close_date: data.expected_close_date || '',
          probability: data.probability?.toString() || '',
          notes: data.notes || '',
        })
        setLoading(false)
      })
      .catch((err) => { alertError('Error', err.message); setLoading(false) })
  }, [id, isEdit, activeCompanyId])

  const stages = pipelines.find((p) => p.id === form.pipeline_id)?.stages || []

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        value: form.value ? parseFloat(form.value) : 0,
        probability: form.probability ? parseInt(form.probability, 10) : null,
        created_by: !isEdit ? user?.id : undefined,
      }
      await guardarDeal(activeCompanyId, payload)
      notify(isEdit ? t('common.actualizado') : t('common.guardado'))
      navigate('/deals')
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
        <h1>{isEdit ? t('deals.editar') : t('deals.nuevo')}</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label={t('deals.titulo')} required value={form.title} onChange={(e) => set('title', e.target.value)} />
        <FormField label={t('deals.valor')} type="number" step="0.01" min="0" placeholder="0.00" value={form.value} onChange={(e) => set('value', e.target.value)} />

        <FormField label={t('deals.pipeline')} as="select" value={form.pipeline_id} onChange={(e) => { set('pipeline_id', e.target.value); set('stage_id', '') }}>
          <option value="">—</option>
          {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </FormField>

        <FormField label={t('deals.etapa')} as="select" value={form.stage_id} onChange={(e) => set('stage_id', e.target.value)} required>
          <option value="">—</option>
          {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </FormField>

        <FormField label={t('deals.contacto')} as="select" value={form.contact_id} onChange={(e) => set('contact_id', e.target.value)}>
          <option value="">—</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </FormField>

        <FormField label={t('deals.empresa')} as="select" value={form.organization_id} onChange={(e) => set('organization_id', e.target.value)}>
          <option value="">—</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </FormField>

        <FormField label={t('deals.fechaCierre')} type="date" value={form.expected_close_date} onChange={(e) => set('expected_close_date', e.target.value)} />
        <FormField label={t('deals.probabilidad')} type="number" min="0" max="100" value={form.probability} onChange={(e) => set('probability', e.target.value)} />
        <FormField label={t('deals.notas')} as="textarea" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button type="submit" disabled={submitting}>{submitting ? t('common.guardando') : t('common.guardar')}</Button>
          <Button variant="ghost" onClick={() => navigate('/deals')}>{t('common.cancelar')}</Button>
        </div>
      </form>
    </div>
  )
}
