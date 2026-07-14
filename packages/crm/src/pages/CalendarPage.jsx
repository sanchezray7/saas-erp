import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import moment from 'moment'
import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { useAuth, Button, FormField, ConfirmModal, alertError, notify } from '@saas/core'
import { listarEventos, guardarEvento, eliminarEvento } from '../data/eventos'

import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'

const localizer = momentLocalizer(moment)
const DragAndDropCalendar = withDragAndDrop(Calendar)

const TYPE_COLORS = {
  reunion: '#3b82f6',
  llamada: '#22c55e',
  tarea: '#f59e0b',
  recordatorio: '#8b5cf6',
  personalizado: '#64748b',
}

const TYPE_LABELS = {
  reunion: '🤝 ',
  llamada: '📞 ',
  tarea: '✅ ',
  recordatorio: '🔔 ',
  personalizado: '📌 ',
}

export function CalendarPage() {
  const { t } = useTranslation()
  const { activeCompanyId, user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date())
  const [view, setView] = useState(Views.MONTH)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    all_day: false,
    type: 'reunion',
    color: '#3b82f6',
  })

  const rangeStart = useMemo(() => moment(date).startOf('month').toDate(), [date])
  const rangeEnd = useMemo(() => moment(date).endOf('month').toDate(), [date])

  const load = useCallback(async () => {
    try {
      const data = await listarEventos(activeCompanyId, rangeStart, rangeEnd)
      setEvents(data)
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, rangeStart, rangeEnd])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    load()
  }, [date, view, load])

  const calendarEvents = useMemo(() =>
    events.map((e) => ({
      id: e.id,
      title: (e.all_day ? '' : moment(e.start_date).format('HH:mm') + ' ') + e.title,
      start: moment(e.start_date).toDate(),
      end: e.end_date ? moment(e.end_date).toDate() : moment(e.start_date).add(1, 'hour').toDate(),
      allDay: e.all_day,
      resource: e,
    })),
    [events]
  )

  function resetForm() {
    setForm({ title: '', description: '', start_date: '', end_date: '', all_day: false, type: 'reunion', color: '#3b82f6' })
    setEditing(null)
    setShowForm(false)
  }

  function handleSelectSlot(slotInfo) {
    const start = moment(slotInfo.start).format('YYYY-MM-DDTHH:mm')
    const end = slotInfo.end ? moment(slotInfo.end).format('YYYY-MM-DDTHH:mm') : ''
    setForm({
      title: '',
      description: '',
      start_date: start,
      end_date: end,
      all_day: slotInfo.action === 'doubleClick' ? false : slotInfo.slots === 1,
      type: 'reunion',
      color: '#3b82f6',
    })
    setEditing(null)
    setShowForm(true)
  }

  function handleSelectEvent(event) {
    const e = event.resource
    setForm({
      title: e.title,
      description: e.description || '',
      start_date: moment(e.start_date).format('YYYY-MM-DDTHH:mm'),
      end_date: e.end_date ? moment(e.end_date).format('YYYY-MM-DDTHH:mm') : '',
      all_day: e.all_day,
      type: e.type,
      color: e.color || '#3b82f6',
    })
    setEditing(e.id)
    setShowForm(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.start_date) return
    setSubmitting(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        start_date: moment(form.start_date).toISOString(),
        end_date: form.end_date ? moment(form.end_date).toISOString() : null,
        all_day: form.all_day,
        type: form.type,
        color: form.color,
        assigned_to: user.id,
      }
      if (editing) payload.id = editing
      await guardarEvento(activeCompanyId, payload)
      notify(editing ? t('common.actualizado') : t('common.guardado'))
      resetForm()
      load()
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    try {
      await eliminarEvento(deleting)
      notify(t('common.eliminado'))
      setDeleting(null)
      load()
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  function handleEventDrop({ event, start, end, allDay }) {
    setSubmitting(true)
    const e = event.resource
    guardarEvento(activeCompanyId, {
      id: e.id,
      title: e.title,
      start_date: moment(start).toISOString(),
      end_date: moment(end).toISOString(),
      all_day: allDay ?? e.all_day,
      type: e.type,
      color: e.color,
      assigned_to: e.assigned_to,
      description: e.description,
    }).then(() => {
      load()
      setSubmitting(false)
    }).catch((err) => {
      alertError('Error', err.message)
      setSubmitting(false)
    })
  }

  function handleEventResize({ event, start, end }) {
    handleEventDrop({ event, start, end, allDay: event.allDay })
  }

  const eventPropGetter = useCallback((event) => ({
    style: {
      backgroundColor: event.resource.color || '#3b82f6',
      borderRadius: '4px',
      border: 'none',
      color: '#fff',
      fontSize: '0.8rem',
    },
  }), [])

  const formats = useMemo(() => ({
    dateFormat: 'D',
    dayFormat: 'ddd D',
    monthHeaderFormat: 'MMMM YYYY',
    dayHeaderFormat: 'dddd D [de] MMMM',
    agendaDateFormat: 'ddd D MMM',
    timeGutterFormat: 'HH:mm',
  }), [])

  const messages = useMemo(() => ({
    today: t('calendar.hoy'),
    previous: t('calendar.anterior'),
    next: t('calendar.siguiente'),
    month: t('calendar.mes'),
    week: t('calendar.semana'),
    day: t('calendar.dia'),
    agenda: t('calendar.agenda'),
    date: t('calendar.fecha'),
    time: t('calendar.hora'),
    event: t('calendar.evento'),
    noEventsInRange: t('calendar.sinEventos'),
    showMore: (total) => `+${total}`,
  }), [t])

  if (loading) {
    return <div className="card"><div className="page-header"><h1>{t('calendar.titulo')}</h1></div><p className="meta" style={{ padding: 40, textAlign: 'center' }}>Cargando...</p></div>
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="card" style={{ padding: '16px 24px' }}>
        <div className="page-header">
          <h1>{t('calendar.titulo')}</h1>
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true) }}>
            {t('calendar.nuevoEvento')}
          </Button>
        </div>

        {showForm && (
          <form onSubmit={handleSave} style={{ marginBottom: 16, padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-alt)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label={t('calendar.tituloField')} required value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} autoFocus />
              <FormField label={t('calendar.tipo')} as="select" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value, color: TYPE_COLORS[e.target.value] }))}>
                <option value="reunion">{t('calendar.tipoReunion')}</option>
                <option value="llamada">{t('calendar.tipoLlamada')}</option>
                <option value="tarea">{t('calendar.tipoTarea')}</option>
                <option value="recordatorio">{t('calendar.tipoRecordatorio')}</option>
                <option value="personalizado">{t('calendar.tipoPersonalizado')}</option>
              </FormField>
              <FormField label={t('calendar.inicio')} type="datetime-local" required value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
              <FormField label={t('calendar.fin')} type="datetime-local" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text)' }}>
                <input type="checkbox" checked={form.all_day} onChange={(e) => setForm((p) => ({ ...p, all_day: e.target.checked }))} />
                {t('calendar.todoElDia')}
              </label>
              <FormField label={t('calendar.color')} type="color" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} />
            </div>
            <div style={{ marginTop: 8 }}>
              <FormField label={t('calendar.descripcion')} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="config-form-actions" style={{ marginTop: 12 }}>
              <Button type="submit" size="sm" disabled={submitting}>{submitting ? t('common.guardando') : (editing ? t('common.actualizar') : t('common.guardar'))}</Button>
              {editing && <Button variant="ghost" size="sm" onClick={() => setDeleting(editing)} style={{ color: 'var(--danger)' }}>{t('common.eliminar')}</Button>}
              <Button variant="ghost" size="sm" onClick={resetForm}>{t('common.cancelar')}</Button>
            </div>
          </form>
        )}

        <div style={{ height: view === Views.MONTH ? 600 : view === Views.WEEK ? 700 : 800 }}>
          <DragAndDropCalendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            date={date}
            view={view}
            onView={setView}
            onNavigate={setDate}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            eventPropGetter={eventPropGetter}
            formats={formats}
            messages={messages}
            selectable
            resizable
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            defaultView={Views.MONTH}
            popup
            style={{ fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {deleting && (
        <ConfirmModal
          title={t('calendar.eliminarEvento')}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </DndProvider>
  )
}
