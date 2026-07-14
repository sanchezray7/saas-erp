import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Skeleton, formatMoney, formatDateTime, MONEDA_POR_PAIS, useAuth } from '@saas/core'
import { obtenerDeal } from '../data/deals'
import { listarActividades, guardarActividad, eliminarActividad } from '../data/activities'

export function DealDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { pais } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'USD'
  const [deal, setDeal] = useState(null)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'note', subject: '', description: '', due_date: '' })

  useEffect(() => {
    setLoading(true)
    obtenerDeal(id)
      .then((d) => {
        setDeal(d)
        return listarActividades(d.company_id, { dealId: id }).catch(() => [])
      })
      .then((acts) => setActivities(acts))
      .catch(setError)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Skeleton.Card />
  if (error) return <div className="card"><p className="meta">Error: {error.message}</p></div>
  if (!deal) return <div className="card"><p className="meta">{t('common.sinDatos')}</p></div>

  return (
    <div className="card">
      <div className="page-header">
        <h1>{deal.title}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/deals/${id}/edit`}><Button size="sm">{t('common.editar')}</Button></Link>
          <Link to="/deals"><Button variant="ghost" size="sm">{t('common.volver')}</Button></Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="detail-field">
          <span className="detail-label">{t('deals.valor')}</span>
          <span className="detail-value">{formatMoney(deal.value, moneda)}</span>
        </div>
        <div className="detail-field">
          <span className="detail-label">{t('deals.etapa')}</span>
          <span className="detail-value">
            <span className="badge" style={{ background: deal.stage?.color || '#6366f1', color: '#fff' }}>
              {deal.stage?.name || '-'}
            </span>
          </span>
        </div>
        <div className="detail-field">
          <span className="detail-label">{t('deals.contacto')}</span>
          <span className="detail-value">{deal.contact?.name || '-'}</span>
        </div>
        <div className="detail-field">
          <span className="detail-label">{t('deals.empresa')}</span>
          <span className="detail-value">{deal.organization?.name || '-'}</span>
        </div>
        <div className="detail-field">
          <span className="detail-label">{t('deals.fechaCierre')}</span>
          <span className="detail-value">{deal.expected_close_date || '-'}</span>
        </div>
        <div className="detail-field">
          <span className="detail-label">{t('deals.probabilidad')}</span>
          <span className="detail-value">{deal.probability != null ? `${deal.probability}%` : '-'}</span>
        </div>
      </div>

      {deal.notes && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 8 }}>{t('deals.notas')}</h3>
          <p className="meta" style={{ whiteSpace: 'pre-wrap' }}>{deal.notes}</p>
        </div>
      )}

      <div style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
        <div className="page-header">
          <h3>{t('deals.timeline')}</h3>
          <Button size="sm" variant="ghost" onClick={() => setShowForm(!showForm)}>
            {showForm ? t('common.cancelar') : t('activities.nueva')}
          </Button>
        </div>

        {showForm && (
          <form onSubmit={async (e) => {
            e.preventDefault()
            try {
              await guardarActividad(deal.company_id, { ...form, deal_id: id })
              const acts = await listarActividades(deal.company_id, { dealId: id }).catch(() => [])
              setActivities(acts)
              setForm({ type: 'note', subject: '', description: '', due_date: '' })
              setShowForm(false)
            } catch (err) {
              alert(err.message)
            }
          }} style={{ marginBottom: 16, padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-alt)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <select className="form-input" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                <option value="note">{t('activities.tipo_note')}</option>
                <option value="call">{t('activities.tipo_call')}</option>
                <option value="email">{t('activities.tipo_email')}</option>
                <option value="meeting">{t('activities.tipo_meeting')}</option>
                <option value="task">{t('activities.tipo_task')}</option>
              </select>
              <input type="datetime-local" className="form-input" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} placeholder={t('activities.fechaVencimiento')} />
            </div>
            <input type="text" className="form-input" style={{ marginBottom: 8 }} placeholder={t('activities.asunto')} value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} required />
            <textarea className="form-input" style={{ marginBottom: 8 }} placeholder={t('activities.descripcion')} rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            <Button type="submit" size="sm">{t('common.guardar')}</Button>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activities.length === 0 ? (
            <p className="meta" style={{ textAlign: 'center', padding: 24 }}>{t('common.sinDatos')}</p>
          ) : activities.map((act) => (
            <div key={act.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-alt)', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.1rem' }}>
                {act.type === 'call' ? '📞' : act.type === 'email' ? '✉️' : act.type === 'meeting' ? '🤝' : act.type === 'task' ? '✅' : '📝'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{act.subject || act.type}</div>
                {act.description && <p className="meta" style={{ fontSize: '0.78rem', marginTop: 2 }}>{act.description}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: '0.72rem', color: 'var(--color-text-soft)' }}>
                  <span>{formatDateTime(act.created_at)}</span>
                  {act.due_date && <span>📅 {formatDateTime(act.due_date)}</span>}
                  {act.done && <span style={{ color: 'var(--color-success)' }}>✓ {t('activities.completadas')}</span>}
                </div>
              </div>
              <button
                type="button"
                className="sidebar-action"
                style={{ fontSize: '0.75rem', flexShrink: 0 }}
                onClick={async () => {
                  try {
                    await eliminarActividad(act.id)
                    setActivities((prev) => prev.filter((a) => a.id !== act.id))
                  } catch {}
                }}
              >✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
