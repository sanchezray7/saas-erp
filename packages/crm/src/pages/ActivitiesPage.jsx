import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, ConfirmModal, alertError, notify, formatDate } from '@saas/core'
import { listarActividades, guardarActividad, eliminarActividad, toggleActividad } from '../data/activities'

const TIPO_LABELS = { call: '📞 Llamada', email: '✉️ Correo', meeting: '🤝 Reunión', note: '📝 Nota', task: '✅ Tarea' }

export function ActivitiesPage() {
  const { t } = useTranslation()
  const { activeCompanyId } = useAuth()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [filterDone, setFilterDone] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ type: 'task', subject: '', description: '', due_date: '' })

  const load = useCallback(async () => {
    try {
      const filters = {}
      if (filterType) filters.type = filterType
      if (filterDone === 'pending') filters.done = false
      else if (filterDone === 'done') filters.done = true
      const data = await listarActividades(activeCompanyId, filters)
      setActivities(data)
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, filterType, filterDone])

  useEffect(() => { load() }, [load])

  async function handleToggle(id, current) {
    try {
      await toggleActividad(id, !current)
      setActivities((prev) => prev.map((a) => a.id === id ? { ...a, done: !current } : a))
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  async function handleDelete(id) {
    try {
      await eliminarActividad(id)
      notify(t('common.eliminado'))
      setActivities((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      alertError('Error', err.message)
    }
    setDeleting(null)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await guardarActividad(activeCompanyId, form)
      notify(t('common.guardado'))
      setShowForm(false)
      setForm({ type: 'task', subject: '', description: '', due_date: '' })
      load()
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>{t('activities.titulo')}</h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? t('common.cancelar') : t('activities.nueva')}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ marginBottom: 20, padding: 16, background: 'var(--color-surface-2)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="form-input" style={{ maxWidth: 160 }} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
              {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <select className="form-input" style={{ maxWidth: 160 }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">{t('activities.todosTipos')}</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="form-input" style={{ maxWidth: 140 }} value={filterDone} onChange={(e) => setFilterDone(e.target.value)}>
          <option value="">{t('activities.todosEstados')}</option>
          <option value="pending">{t('activities.pendientes')}</option>
          <option value="done">{t('activities.completadas')}</option>
        </select>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 40 }}></th>
            <th>{t('activities.tipo')}</th>
            <th>{t('activities.asunto')}</th>
            <th>{t('activities.fecha')}</th>
            <th>{t('activities.relacionado')}</th>
            <th>{t('common.acciones')}</th>
          </tr>
        </thead>
        <tbody>
          {activities.length === 0 ? (
            <tr>
              <td colSpan={6} className="meta" style={{ textAlign: 'center', padding: 32 }}>
                {t('common.sinDatos')}
              </td>
            </tr>
          ) : activities.map((a) => (
            <tr key={a.id} style={{ opacity: a.done ? 0.5 : 1 }}>
              <td data-label="">
                <input type="checkbox" checked={a.done} onChange={() => handleToggle(a.id, a.done)} style={{ cursor: 'pointer' }} />
              </td>
              <td data-label={t('activities.asunto')}>{TIPO_LABELS[a.type] || a.type}</td>
              <td data-label={t('activities.contacto')}>{a.subject}</td>
              <td data-label={t('activities.oportunidad')}>{a.due_date ? formatDate(a.due_date) : '-'}</td>
              <td data-label={t('common.fecha')}>
                {a.contact?.name && <span>{a.contact.name}</span>}
                {a.deal?.title && <span>{a.contact?.name ? ' · ' : ''}{a.deal.title}</span>}
                {!a.contact && !a.deal && <span className="meta">-</span>}
              </td>
              <td data-label="">
                <Button size="xs" danger onClick={() => setDeleting(a.id)}>{t('common.eliminar')}</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && (
        <ConfirmModal
          title={t('activities.eliminar')}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
