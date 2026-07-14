import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, formatDateTime, alertError, notify } from '@saas/core'
import { obtenerContacto } from '../data/contacts'
import { listarActividades, guardarActividad, eliminarActividad } from '../data/activities'
import { listarDeals } from '../data/deals'
import { summarizeContact, scoreContact } from '../data/ai'
import { enviarWhatsApp, WhatsAppTemplateModal } from '@saas/whatsapp'
import { listarTagsDeContacto } from '../data/tags'
import { listarTemplates } from '../data/emailTemplates'

const TIPO_ICON = { call: '📞', email: '✉️', meeting: '🤝', note: '📝', task: '✅', whatsapp: '💬' }

export function ContactDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { activeCompanyId, user, companies } = useAuth()
  const [contact, setContact] = useState(null)
  const [activities, setActivities] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ type: 'note', subject: '', description: '', due_date: '' })
  const [aiSummary, setAiSummary] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [contactTags, setContactTags] = useState([])
  const [waTemplates, setWaTemplates] = useState([])
  const [scoreData, setScoreData] = useState(null)
  const [scoreLoading, setScoreLoading] = useState(false)
  const [scoreError, setScoreError] = useState(null)
  const [showWhatsApp, setShowWhatsApp] = useState(false)

  const load = useCallback(async () => {
    try {
      const [c, acts, d] = await Promise.all([
        obtenerContacto(id),
        listarActividades(activeCompanyId, { contactId: id }),
        listarDeals(activeCompanyId),
      ])
      setContact(c)
      setAiSummary(c.ai_summary || null)
      setScoreData(c.score != null ? { score: c.score, reasoning: c.score_reasoning || '' } : null)
      listarTagsDeContacto(id).then(setContactTags).catch(() => {})
      setActivities(acts)
      setDeals(d.filter((deal) => deal.contact_id === id))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [id, activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleCreateActivity(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await guardarActividad(activeCompanyId, { ...form, contact_id: id })
      notify(t('common.guardado'))
      setShowForm(false)
      setForm({ type: 'note', subject: '', description: '', due_date: '' })
      const acts = await listarActividades(activeCompanyId, { contactId: id })
      setActivities(acts)
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteActivity(activityId) {
    try {
      await eliminarActividad(activityId)
      notify(t('common.eliminado'))
      setActivities((prev) => prev.filter((a) => a.id !== activityId))
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  async function handleScore() {
    setScoreLoading(true)
    setScoreError(null)
    try {
      const res = await scoreContact(id)
      if (res.score == null) throw new Error('No se pudo calcular el score')
      setScoreData({ score: res.score, reasoning: res.reasoning })
      notify('Score calculado correctamente')
    } catch (err) {
      setScoreError(err.message)
      alertError('Error al calcular score', err.message)
    } finally {
      setScoreLoading(false)
    }
  }

  async function handleSummarize() {
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await summarizeContact(id)
      if (!res.summary) throw new Error('El resumen generado está vacío')
      setAiSummary(res.summary)
      notify('Resumen generado correctamente')
    } catch (err) {
      setAiError(err.message)
      alertError('Error al generar resumen', err.message)
    } finally {
      setAiLoading(false)
    }
  }

  if (loading) return <Skeleton.Card />
  if (error) return <div className="card"><p className="meta">Error: {error.message}</p></div>
  if (!contact) return <div className="card"><p className="meta">{t('common.sinDatos')}</p></div>

  const timeline = [
    ...activities.map((a) => ({ ...a, _type: 'activity' })),
    ...deals.map((d) => ({ ...d, _type: 'deal', _date: d.updated_at || d.created_at })),
  ].sort((a, b) => new Date(b.created_at || b._date) - new Date(a.created_at || a._date))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Info del contacto */}
      <div className="card">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ margin: 0 }}>{contact.name}</h1>
            {scoreData != null && (
              <span className="badge" style={{
                fontSize: '0.75rem',
                padding: '2px 10px',
                background: scoreData.score >= 67 ? 'var(--color-success)' : scoreData.score >= 34 ? 'var(--color-warning)' : 'var(--color-danger)',
                color: '#fff',
              }}>
                {scoreData.score >= 67 ? '🟢' : scoreData.score >= 34 ? '🟡' : '🔴'} {scoreData.score}/100
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to={`/contacts/${id}/edit`}><Button size="sm">{t('common.editar')}</Button></Link>
            {contact.phone && (
              <Button size="sm" variant="ghost" onClick={() => { setShowWhatsApp(true); listarTemplates(activeCompanyId, 'whatsapp').then(setWaTemplates).catch(() => {}) }}>📱 WhatsApp</Button>
            )}
            <Link to="/contacts"><Button variant="ghost" size="sm">{t('common.volver')}</Button></Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <div className="detail-field">
            <span className="detail-label">{t('contacts.email')}</span>
            <span className="detail-value">{contact.email || '-'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">{t('contacts.telefono')}</span>
            <span className="detail-value">{contact.phone || '-'}</span>
          </div>
          {contact.ruc && (
            <div className="detail-field">
              <span className="detail-label">RUC / DV</span>
              <span className="detail-value">{contact.ruc}-{contact.dv}</span>
            </div>
          )}
          {!contact.ruc && contact.num_documento && (
            <div className="detail-field">
              <span className="detail-label">Documento</span>
              <span className="detail-value">{contact.num_documento} ({contact.tipo_documento === 1 ? 'Cédula' : contact.tipo_documento === 2 ? 'Pasaporte' : '—'})</span>
            </div>
          )}
          {contact.direccion && (
            <div className="detail-field">
              <span className="detail-label">Dirección</span>
              <span className="detail-value">{contact.direccion}</span>
            </div>
          )}
          {contact.pais && contact.pais !== 'PRY' && (
            <div className="detail-field">
              <span className="detail-label">País</span>
              <span className="detail-value">{contact.pais}</span>
            </div>
          )}
          <div className="detail-field">
            <span className="detail-label">{t('contacts.cargo')}</span>
            <span className="detail-value">{contact.position || '-'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">{t('contacts.empresa')}</span>
            <span className="detail-value">{contact.organization?.name || '-'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">{t('contacts.asignadoA')}</span>
            <span className="detail-value">{contact.assigned_to?.email || '-'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">{t('contacts.origen')}</span>
            <span className="detail-value">{contact.source || '-'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">{t('contacts.notas')}</span>
            <span className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{contact.notes || '-'}</span>
          </div>
          {contactTags.length > 0 && (
            <div className="detail-field" style={{ gridColumn: 'span 2' }}>
              <span className="detail-label">🏷️ Etiquetas</span>
              <span className="detail-value" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {contactTags.map((tag) => (
                  <span key={tag.id} style={{
                    padding: '1px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
                    background: (tag.color || '#6366f1') + '20',
                    color: tag.color || '#6366f1',
                  }}>
                    {tag.nombre}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Resumen IA */}
      <div className="card">
        <div className="page-header">
          <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>
            🤖 Resumen IA
          </h2>
          <Button size="sm" onClick={handleSummarize} disabled={aiLoading}>
            {aiLoading ? 'Generando...' : aiSummary ? 'Regenerar' : 'Resumir con IA'}
          </Button>
        </div>
        {aiSummary && (
          <p style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--color-text)' }}>
            {aiSummary}
          </p>
        )}
        {aiError && (
          <p className="meta" style={{ marginTop: 12, color: 'var(--color-danger)' }}>
            Error: {aiError}
          </p>
        )}
        {!aiSummary && !aiError && !aiLoading && (
          <p className="meta" style={{ marginTop: 12 }}>
            Presiona "Resumir con IA" para generar un resumen de las interacciones con este contacto.
          </p>
        )}
      </div>

      {/* Score IA */}
      <div className="card">
        <div className="page-header">
          <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>
            🎯 Lead Score
          </h2>
          <Button size="sm" onClick={handleScore} disabled={scoreLoading}>
            {scoreLoading ? 'Calculando...' : scoreData ? 'Recalcular' : 'Calcular score'}
          </Button>
        </div>
        {scoreData && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 64, height: 64, borderRadius: '50%',
                fontSize: '1.4rem', fontWeight: 700,
                background: scoreData.score >= 67 ? 'var(--color-success)' : scoreData.score >= 34 ? 'var(--color-warning)' : 'var(--color-danger)',
                color: '#fff',
              }}>
                {scoreData.score}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {scoreData.score >= 67 ? '🟢 Caliente' : scoreData.score >= 34 ? '🟡 Tibio' : '🔴 Frío'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {scoreData.reasoning}
                </div>
              </div>
            </div>
          </div>
        )}
        {scoreError && (
          <p className="meta" style={{ marginTop: 12, color: 'var(--color-danger)' }}>
            Error: {scoreError}
          </p>
        )}
        {!scoreData && !scoreError && !scoreLoading && (
          <p className="meta" style={{ marginTop: 12 }}>
            Presiona "Calcular score" para evaluar la probabilidad de conversión de este lead.
          </p>
        )}
      </div>

      {/* Oportunidades vinculadas */}
      {deals.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>
            💼 {t('contacts.oportunidadesVinculadas')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {deals.map((deal) => (
              <Link key={deal.id} to={`/deals/${deal.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--color-surface-alt)', borderRadius: 'var(--radius)', textDecoration: 'none', border: '1px solid var(--color-border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{deal.title}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {deal.organization?.name || '-'}
                  </div>
                </div>
                <span className="badge" style={{ background: deal.stage?.color || '#6366f1', color: '#fff', fontSize: '0.7rem' }}>
                  {deal.stage?.name || '-'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="card">
        <div className="page-header">
          <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>
            📋 {t('contacts.timeline')}
          </h2>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? t('common.cancelar') : t('activities.nueva')}
          </Button>
        </div>

        {showForm && (
          <form onSubmit={handleCreateActivity} style={{ marginBottom: 20, padding: 16, background: 'var(--color-surface-2)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="form-input" style={{ maxWidth: 160 }} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                {Object.entries(TIPO_ICON).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}
              </select>
              <input className="form-input" type="text" placeholder={t('activities.asunto')} required value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} style={{ flex: 1 }} />
            </div>
            <textarea className="form-input" rows={2} placeholder={t('activities.descripcion')} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="form-input" type="datetime-local" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} />
              <Button type="submit" disabled={submitting} size="sm">{submitting ? t('common.guardando') : t('common.guardar')}</Button>
            </div>
          </form>
        )}

        {timeline.length === 0 ? (
          <p className="meta" style={{ textAlign: 'center', padding: 32 }}>{t('contacts.sinActividades')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {timeline.map((entry) =>
              entry._type === 'deal' ? (
                <DealTimelineCard key={entry.id} deal={entry} />
              ) : (
                <ActivityTimelineRow
                  key={entry.id}
                  activity={entry}
                  onDelete={handleDeleteActivity}
                />
              )
            )}
          </div>
        )}
      </div>

      {showWhatsApp && (
        <WhatsAppTemplateModal
          contact={contact}
          companyId={activeCompanyId}
          templates={waTemplates}
          companyName={companies.find((c) => c.id === activeCompanyId)?.name || ''}
          userName={user?.email?.split('@')[0] || ''}
          userEmail={user?.email || ''}
          userPhone={user?.user_metadata?.phone || ''}
          onSend={(message) => enviarWhatsApp({
            companyId: activeCompanyId,
            contactId: id,
            to: contact.phone,
            body: message,
          })}
          onClose={() => { setShowWhatsApp(false); load() }}
        />
      )}
    </div>
  )
}

function ActivityTimelineRow({ activity, onDelete }) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
      <div style={{ fontSize: '1.2rem', lineHeight: 1.4, flexShrink: 0 }}>{TIPO_ICON[activity.type] || '📌'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{activity.subject}</span>
            <span className="meta" style={{ marginLeft: 8, fontSize: '0.72rem' }}>{activity.type}</span>
          </div>
          <Button size="xs" danger onClick={() => onDelete(activity.id)}>{t('common.eliminar')}</Button>
        </div>
        {activity.description && (
          <p className="meta" style={{ marginTop: 4, whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>{activity.description}</p>
        )}
        <div className="meta" style={{ marginTop: 4, fontSize: '0.72rem' }}>
          {formatDateTime(activity.created_at)}
          {activity.due_date && !activity.done && <span style={{ marginLeft: 8, color: 'var(--color-warning)' }}>⏰ {formatDateTime(activity.due_date)}</span>}
          {activity.done && <span style={{ marginLeft: 8 }}>✅ {t('activities.completadas')}</span>}
        </div>
      </div>
    </div>
  )
}

function DealTimelineCard({ deal }) {
  return (
    <Link to={`/deals/${deal.id}`} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', textDecoration: 'none' }}>
      <div style={{ fontSize: '1.2rem', lineHeight: 1.4, flexShrink: 0 }}>💼</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text)' }}>{deal.title}</span>
          <span className="badge" style={{ background: deal.stage?.color || '#6366f1', color: '#fff', fontSize: '0.65rem' }}>
            {deal.stage?.name || '-'}
          </span>
        </div>
        <div className="meta" style={{ marginTop: 2, fontSize: '0.78rem' }}>
          {deal.organization?.name || '-'}
        </div>
      </div>
    </Link>
  )
}
