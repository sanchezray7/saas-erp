import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, formatMoney } from '@saas/core'
import { obtenerAgenda } from '../data/agenda'
import { toggleActividad } from '../data/activities'

const TYPE_ICONS = {
  call: '📞', email: '✉️', meeting: '🤝', note: '📝', task: '✅',
}

const EVENTO_ICONS = {
  reunion: '🤝', llamada: '📞', tarea: '✅', recordatorio: '🔔', personalizado: '📌',
}

export function AgendaModal({ onClose }) {
  const { t } = useTranslation()
  const { activeCompanyId, user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!activeCompanyId || !user) return
    obtenerAgenda(activeCompanyId, user.id)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeCompanyId, user])

  async function handleToggle(id, done) {
    setToggling(id)
    try {
      await toggleActividad(id, !done)
      setData((prev) => ({
        ...prev,
        actividades: prev.actividades.map((a) =>
          a.id === id ? { ...a, done: !done } : a
        ),
      }))
    } catch {
      // revert on error
    } finally {
      setToggling(null)
    }
  }

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const { resumen, actividades, eventos, expiring } = data || {}
  const pendingCount = (actividades?.length || 0) + (expiring?.length || 0)

  const hora = new Date().getHours()
  const saludo = hora < 12 ? '☀️ Buenos días' : hora < 18 ? '🌤️ Buenas tardes' : '🌙 Buenas noches'

  return (
    <div className="modal-overlay">
      <div ref={ref} className="agenda-modal">
        <div className="agenda-header">
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
            {saludo}, {user?.user_metadata?.full_name || ''}
          </h2>
          <button type="button" className="agenda-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <p className="meta" style={{ padding: 32, textAlign: 'center' }}>Cargando...</p>
        ) : (
          <>
            <div className="agenda-resumen">
              <div className="agenda-kpi">
                <span className="agenda-kpi-icon">📞</span>
                <span className="agenda-kpi-value">{resumen?.llamadas ?? 0}</span>
                <span className="agenda-kpi-label">{t('agenda.llamadas')}</span>
              </div>
              <div className="agenda-kpi">
                <span className="agenda-kpi-icon">🤝</span>
                <span className="agenda-kpi-value">{resumen?.reuniones ?? 0}</span>
                <span className="agenda-kpi-label">{t('agenda.reuniones')}</span>
              </div>
              <div className="agenda-kpi">
                <span className="agenda-kpi-icon">✅</span>
                <span className="agenda-kpi-value">{resumen?.tareas ?? 0}</span>
                <span className="agenda-kpi-label">{t('agenda.tareas')}</span>
              </div>
              <div className="agenda-kpi">
                <span className="agenda-kpi-icon">⏰</span>
                <span className="agenda-kpi-value">{resumen?.propuestas ?? 0}</span>
                <span className="agenda-kpi-label">{t('agenda.propuestas')}</span>
              </div>
            </div>

            <div className="agenda-section">
              <h3 className="agenda-section-title">{t('agenda.pendientes')}</h3>
              {(!actividades || actividades.length === 0) ? (
                <p className="meta" style={{ padding: '8px 0' }}>{t('agenda.sinActividades')}</p>
              ) : (
                <div className="agenda-list" style={{ display: 'flex', flexDirection: 'column' }}>
                  {actividades.map((a) => (
                    <label key={a.id} className="agenda-item" style={{ opacity: a.done ? 0.4 : 1 }}>
                      <input
                        type="checkbox"
                        checked={a.done}
                        disabled={toggling === a.id}
                        onChange={() => handleToggle(a.id, a.done)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>{TYPE_ICONS[a.type] || '📌'} {a.subject}</span>
                      {a.due_date && (
                        <span className="meta" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>
                          {new Date(a.due_date).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="agenda-section">
              <h3 className="agenda-section-title">{t('agenda.hoy')}</h3>
              {(!eventos || eventos.length === 0) ? (
                <p className="meta" style={{ padding: '8px 0' }}>{t('agenda.sinEventos')}</p>
              ) : (
                <div className="agenda-list" style={{ display: 'flex', flexDirection: 'column' }}>
                  {eventos.map((e) => (
                    <div key={e.id} className="agenda-item" style={{ cursor: 'default' }}>
                      <span style={{ width: 20, textAlign: 'center' }}>{EVENTO_ICONS[e.type] || '📌'}</span>
                      <span style={{ flex: 1 }}>{e.title}</span>
                      <span className="meta" style={{ fontSize: '0.75rem' }}>
                        {new Date(e.start_date).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="agenda-section">
              <h3 className="agenda-section-title">{t('agenda.proximos7Dias')}</h3>
              {(!expiring || expiring.length === 0) ? (
                <p className="meta" style={{ padding: '8px 0' }}>{t('agenda.sinPropuestas')}</p>
              ) : (
                <div className="agenda-list" style={{ display: 'flex', flexDirection: 'column' }}>
                  {expiring.map((d) => {
                    const daysLeft = Math.ceil((new Date(d.expected_close_date) - new Date()) / (1000 * 60 * 60 * 24))
                    return (
                      <div key={d.id} className="agenda-item" style={{ cursor: 'default' }}>
                        <span>💼</span>
                        <span style={{ flex: 1 }}>{d.title}</span>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{formatMoney(d.value, 'USD')}</span>
                        <span className="meta" style={{ fontSize: '0.72rem', marginLeft: 8, color: daysLeft <= 1 ? 'var(--color-danger)' : 'var(--color-text-soft)' }}>
                          {daysLeft <= 0 ? t('agenda.expiranHoy') : t('agenda.venceEn', { dias: daysLeft })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        .agenda-modal { width: 90%; max-width: 520px; max-height: 85vh; background: var(--color-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; overflow: hidden; margin-top: 40px; }
        .agenda-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; border-bottom: 1px solid var(--color-border); }
        .agenda-close { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: var(--color-text-soft); padding: 4px 8px; border-radius: 6px; }
        .agenda-close:hover { background: var(--color-surface-alt); }
        .agenda-resumen { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 16px 20px; }
        .agenda-kpi { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 12px 4px; background: var(--color-surface-alt); border-radius: var(--radius); }
        .agenda-kpi-icon { font-size: 1.2rem; }
        .agenda-kpi-value { font-size: 1.5rem; font-weight: 700; color: var(--color-accent); line-height: 1.1; }
        .agenda-kpi-label { font-size: 0.68rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.03em; text-align: center; }
        .agenda-section { padding: 0 20px 16px; }
        .agenda-section-title { font-size: 0.85rem; font-weight: 600; margin: 0 0 8px; color: var(--color-text); }
        .agenda-list { display: flex; flex-direction: column; gap: 2px; }
        .agenda-item { display: flex; align-items: center; gap: 8px; padding: 8px 8px; font-size: 0.85rem; border-radius: var(--radius); cursor: pointer; transition: background 0.1s; }
        .agenda-item:hover { background: var(--color-surface-alt); }
        .agenda-item input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--color-accent); flex-shrink: 0; }
        .agenda-scroll { overflow-y: auto; flex: 1; }
      `}</style>
    </div>
  )
}
