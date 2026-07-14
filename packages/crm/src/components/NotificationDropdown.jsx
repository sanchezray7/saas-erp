import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, FormField, alertError, notify, PERMISSIONS } from '@saas/core'
import { listarNotificaciones, contarNoLeidas, marcarLeida, marcarTodasLeidas, crearNotificacion, crearNotificacionTodos } from '../data/notifications'
import { listarMiembros } from '../data/roundRobin'

const TYPE_ICONS = {
  contacto_asignado: '👤',
  deal_stage_change: '💼',
  info: 'ℹ️',
}

export function NotificationBell() {
  const { t } = useTranslation()
  const { activeCompanyId, user, can, roles } = useAuth()
  const isAdmin = roles.includes('admin') || can(PERMISSIONS.CONFIG_CREAR)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [miembros, setMiembros] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ user_id: '', title: '', message: '', link: '', toAll: false })
  const [submitting, setSubmitting] = useState(false)
  const ref = useRef(null)

  const load = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const [notifs, count] = await Promise.all([
        listarNotificaciones(activeCompanyId),
        contarNoLeidas(activeCompanyId),
      ])
      setNotifications(notifs)
      setUnreadCount(count)
    } catch (err) {
      // fail silently
    }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (open && isAdmin && miembros.length === 0) {
      listarMiembros(activeCompanyId).then(setMiembros).catch(() => {})
    }
  }, [open, isAdmin, activeCompanyId, miembros.length])

  // Poll cada 30s
  useEffect(() => {
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleClickNotif(n) {
    if (!n.read) {
      try { await marcarLeida(n.id) } catch {}
      setUnreadCount((c) => Math.max(0, c - 1))
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))
    }
    if (n.link) window.location.href = n.link
  }

  async function handleSendNotif(e) {
    e.preventDefault()
    if (!form.user_id || !form.title.trim()) return
    setSubmitting(true)
    try {
      if (form.toAll) {
        await crearNotificacionTodos(activeCompanyId, 'info', form.title.trim(), form.message.trim(), form.link.trim() || null)
      } else {
        await crearNotificacion(activeCompanyId, form.user_id, 'info', form.title.trim(), form.message.trim(), form.link.trim() || null)
      }
      notify(t('notifications.enviada'))
      setForm({ user_id: '', title: '', message: '', link: '', toAll: false })
      setShowForm(false)
      load()
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMarkAllRead() {
    try {
      await marcarTodasLeidas(activeCompanyId)
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="sidebar-action"
        onClick={() => setOpen(!open)}
        title={t('notifications.titulo')}
        style={{ position: 'relative', fontSize: '1.1rem' }}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

        {open && (
          <div className="modal-overlay" onClick={() => setOpen(false)}>
            <div className="notif-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="notif-header">
                <strong>{t('notifications.titulo')}</strong>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {unreadCount > 0 && (
                    <button type="button" className="notif-mark-read" onClick={handleMarkAllRead}>
                      {t('notifications.marcarLeidas')}
                    </button>
                  )}
                  {isAdmin && (
                    <button type="button" className="notif-mark-read" onClick={() => setShowForm(!showForm)}>
                      {showForm ? '✕' : '+'}
                    </button>
                  )}
                  <button type="button" className="sidebar-action" onClick={() => setOpen(false)} style={{ fontSize: '0.85rem' }}>✕</button>
                </div>
              </div>

              {showForm && isAdmin && (
                <form onSubmit={handleSendNotif} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.toAll} onChange={(e) => setForm((p) => ({ ...p, toAll: e.target.checked }))} />
                    {t('notifications.enviarATodos')}
                  </label>
                  {!form.toAll && (
                    <select className="form-input" value={form.user_id} onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))} required style={{ fontSize: '0.82rem' }}>
                      <option value="">{t('notifications.seleccionarUsuario')}</option>
                      {miembros.map((m) => (
                        <option key={m.id} value={m.user_id}>{m.email || m.user_id}</option>
                      ))}
                    </select>
                  )}
                  <input type="text" className="form-input" placeholder={t('notifications.tituloNotif')} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required style={{ fontSize: '0.82rem' }} />
                  <input type="text" className="form-input" placeholder={t('notifications.mensaje')} value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} style={{ fontSize: '0.82rem' }} />
                  <input type="text" className="form-input" placeholder={t('notifications.enlace')} value={form.link} onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))} style={{ fontSize: '0.82rem' }} />
                  <Button type="submit" size="sm" disabled={submitting}>{submitting ? t('common.guardando') : t('notifications.enviar')}</Button>
                </form>
              )}

              <div className="notif-list">
                {notifications.length === 0 ? (
                  <p className="meta" style={{ padding: 16, textAlign: 'center' }}>{t('notifications.sinNotificaciones')}</p>
                ) : notifications.slice(0, 20).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`notif-item ${n.read ? '' : 'notif-item--unread'}`}
                    onClick={() => handleClickNotif(n)}
                  >
                    <span className="notif-icon">{TYPE_ICONS[n.type] || 'ℹ️'}</span>
                    <div className="notif-body">
                      <span className="notif-title">{n.title}</span>
                      {n.message && <span className="notif-message">{n.message}</span>}
                      <span className="notif-time">{formatRelativeTime(n.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      <style>{`
        .notif-badge { position: absolute; top: -4px; right: -4px; background: var(--color-danger); color: #fff; font-size: 0.6rem; font-weight: 700; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; line-height: 1; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: flex-start; justify-content: center; padding-top: 80px; z-index: 1000; }
        .notif-dropdown { width: 90%; max-width: 440px; max-height: 80vh; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; overflow: hidden; }
        .notif-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--color-border); font-size: 0.9rem; }
        .notif-mark-read { background: none; border: none; color: var(--color-accent); cursor: pointer; font-size: 0.78rem; font-family: inherit; white-space: nowrap; }
        .notif-mark-read:hover { text-decoration: underline; }
        .notif-list { overflow-y: auto; flex: 1; }
        .notif-item { display: flex; gap: 10px; padding: 12px 16px; cursor: pointer; background: none; border: none; width: 100%; text-align: left; font-family: inherit; border-bottom: 1px solid var(--color-border); font-size: 0.85rem; transition: background 0.1s; }
        .notif-item:hover { background: var(--color-surface-alt); }
        .notif-item--unread { background: var(--color-accent-soft); }
        .notif-icon { font-size: 1.2rem; flex-shrink: 0; margin-top: 2px; }
        .notif-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .notif-title { font-weight: 600; color: var(--color-text); font-size: 0.85rem; }
        .notif-message { color: var(--color-text-muted); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .notif-time { color: var(--color-text-soft); font-size: 0.68rem; }
      `}</style>
    </div>
  )
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days}d`
  return new Date(dateStr).toLocaleDateString()
}
