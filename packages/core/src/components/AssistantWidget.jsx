import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { getSupabase } from '../lib/supabase'
import { getPathContext } from '../data/pathContext'
import { useAuth } from '../auth/context'
import { usePlan } from '../data/plan'
import { PLAN_LABELS } from '../data/planConfig'

const STORAGE_KEY = 'asistente_chat_v1'

// Chips contextuales por feature (sugerencias proactivas según la página)
const FEATURE_SUGGESTIONS = {
  srm: ['sug.crearOc', 'sug.facturaProveedor'],
  inventario: ['sug.transferencia', 'sug.kardex'],
  contabilidad: ['sug.asiento', 'sug.planCuentas'],
  contabilidad_avanzada: ['sug.aging', 'sug.conciliacion'],
  rrhh: ['sug.asistencia', 'sug.vacaciones'],
  nomina: ['sug.liquidarNomina', 'sug.reciboSueldo'],
  pos: ['sug.cobroPos', 'sug.cierreCaja'],
  produccion: ['sug.ordenProduccion', 'sug.receta'],
  servicios: ['sug.presupuestoServicio', 'sug.ordenTrabajo'],
  notas_cd: ['sug.notaCD'],
  reportes: ['sug.reportes'],
}

// Renderiza texto con soporte básico de markdown (**negrita**, listas)
function renderText(text) {
  const lines = String(text || '').split('\n')
  const elements = []
  let list = null

  const flushList = (key) => {
    if (list) {
      elements.push(
        <ul key={key} className="asistente-ul">
          {list.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>,
      )
      list = null
    }
  }

  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line) { flushList(`br-${i}`); return }

    const isNumbered = /^\d+[.)]\s*/.test(line)
    const isBullet = /^[-*•]\s*/.test(line)
    if (isNumbered || isBullet) {
      if (!list) list = []
      list.push(<span key={list.length} dangerouslySetInnerHTML={{ __html: boldify(line.replace(/^\d+[.)]\s*|^[-*•]\s*/, '')) }} />)
      return
    }
    flushList(`end-${i}`)
    elements.push(<p key={i} dangerouslySetInnerHTML={{ __html: boldify(line) }} />)
  })
  flushList('end')

  return elements
}

function boldify(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}

export function AssistantWidget() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const { activeCompanyId, companies } = useAuth()
  const { plan, featureEnabled, featurePlan } = usePlan({ companyId: activeCompanyId })
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)
  const inputRef = useRef(null)

  const ctx = getPathContext(location.pathname)
  const modBloqueado = ctx.featureKey ? !featureEnabled(ctx.featureKey) : false
  const planLabel = PLAN_LABELS[plan]?.name || plan
  const planActual = companies.find((c) => c.id === activeCompanyId)?.plan || plan

  // Chips contextuales: prioriza la feature de la página actual
  const sugerencias = ctx.featureKey && FEATURE_SUGGESTIONS[ctx.featureKey]
    ? FEATURE_SUGGESTIONS[ctx.featureKey]
    : ['assistant.pregunta1', 'assistant.pregunta2', 'assistant.pregunta3']

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)) } catch { /* noop */ }
  }, [messages])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, loading, open])

  const locale = i18n.language || 'es'

  const send = async (raw) => {
    const message = (raw || input).trim()
    if (!message || loading) return
    setMessages((m) => [...m, { role: 'user', content: message }])
    setInput('')
    setError('')
    setLoading(true)
    try {
      const supabase = getSupabase()
      const { data, error: fnError } = await supabase.functions.invoke('asistente', {
        body: {
          message,
          locale,
          contexto: {
            ruta: location.pathname,
            modulo: ctx.modulo,
            plan: planActual,
          },
        },
      })
      if (fnError) throw fnError
      setMessages((m) => [...m, { role: 'assistant', content: data.respuesta || t('assistant.error') }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: t('assistant.error') }])
      setError(t('assistant.error'))
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => setMessages([])

  return (
    <>
      <button
        type="button"
        className="asistente-fab"
        onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 100) }}
        aria-label={t('assistant.titulo')}
        title={t('assistant.titulo')}
      >
        {open ? '✕' : '🤖'}
      </button>

      {open && (
        <div className="asistente-window" role="dialog" aria-label={t('assistant.titulo')}>
          <div className="asistente-header">
            <span className="asistente-title">🤖 {t('assistant.titulo')}</span>
            <button type="button" className="asistente-clear" onClick={clearChat} title="Limpiar">🗑</button>
          </div>

          <div className="asistente-body" ref={listRef}>
            {messages.length === 0 && (
              <div className="asistente-welcome">
                <p>{t('assistant.bienvenida')}</p>
                {modBloqueado && ctx.featureKey && (
                  <div className="asistente-aviso">
                    <p><strong>🔒 {ctx.modulo}</strong></p>
                    <p className="asistente-aviso-text">
                      {t('assistant.moduloBloqueado', { plan: PLAN_LABELS[featurePlan(ctx.featureKey)]?.name })}
                    </p>
                    <div className="asistente-chips">
                      <button type="button" onClick={() => send(t('sug.activarModulo', { modulo: ctx.modulo }))}>
                        {t('sug.activarModulo', { modulo: ctx.modulo })}
                      </button>
                    </div>
                  </div>
                )}
                <div className="asistente-chips">
                  {sugerencias.map((key) => (
                    <button key={key} type="button" onClick={() => send(t(key))}>
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`asistente-msg asistente-${m.role}`}>
                {m.role === 'assistant' ? renderText(m.content) : m.content}
              </div>
            ))}

            {loading && (
              <div className="asistente-msg asistente-assistant">
                <span className="asistente-typing">
                  <span /><span /><span />
                </span>
                <em className="asistente-typing-label">{t('assistant.escribiendo')}</em>
              </div>
            )}

            {error && <p className="asistente-error">{error}</p>}
          </div>

          <div className="asistente-footer">
            <input
              ref={inputRef}
              className="asistente-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send() }}
              placeholder={t('assistant.placeholder')}
            />
            <button type="button" className="asistente-send" onClick={() => send()} disabled={loading || !input.trim()}>
              ➤
            </button>
          </div>
        </div>
      )}

      <style>{`
        .asistente-fab {
          position: fixed; bottom: 24px; right: 24px; z-index: 998;
          width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
          background: var(--color-accent); color: #fff; font-size: 1.4rem;
          box-shadow: 0 8px 24px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .asistente-fab:hover { transform: scale(1.08); background: var(--color-accent-hover); }

        .asistente-window {
          position: fixed; bottom: 96px; right: 24px; z-index: 999;
          width: min(380px, calc(100vw - 32px)); height: min(560px, calc(100vh - 140px));
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: var(--radius-lg); box-shadow: 0 20px 60px rgba(0,0,0,0.25);
          display: flex; flex-direction: column; overflow: hidden;
        }
        .asistente-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; background: var(--color-accent); color: #fff; font-weight: 700;
        }
        .asistente-clear { background: none; border: none; color: #fff; cursor: pointer; font-size: 0.95rem; opacity: 0.85; }
        .asistente-clear:hover { opacity: 1; }

        .asistente-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .asistente-welcome { color: var(--color-text-muted); font-size: 0.9rem; line-height: 1.5; }
        .asistente-chips { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
        .asistente-aviso {
          margin-top: 12px; padding: 12px; border-radius: var(--radius);
          border: 1px solid var(--color-warning); background: var(--color-warning-bg); color: var(--color-text);
          font-size: 0.85rem; line-height: 1.5;
        }
        .asistente-aviso-text { margin-top: 4px; }        .asistente-chips button {
          text-align: left; padding: 9px 12px; border-radius: var(--radius);
          border: 1px solid var(--color-border); background: var(--color-surface-alt); color: var(--color-text);
          cursor: pointer; font-size: 0.85rem;
        }
        .asistente-chips button:hover { border-color: var(--color-accent); color: var(--color-accent); }

        .asistente-msg { max-width: 85%; padding: 10px 13px; border-radius: var(--radius); font-size: 0.9rem; line-height: 1.5; word-break: break-word; }
        .asistente-msg p { margin: 0 0 6px; }
        .asistente-msg p:last-child { margin-bottom: 0; }
        .asistente-msg strong { font-weight: 700; }
        .asistente-msg code { background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.85em; }
        .asistente-ul { margin: 0 0 6px; padding-left: 18px; }
        .asistente-ul:last-child { margin-bottom: 0; }
        .asistente-ul li { margin-bottom: 3px; }
        .asistente-user { align-self: flex-end; background: var(--color-accent); color: #fff; border-bottom-right-radius: 4px; }
        .asistente-assistant { align-self: flex-start; background: var(--color-surface-alt); color: var(--color-text); border: 1px solid var(--color-border); border-bottom-left-radius: 4px; }

        .asistente-typing { display: inline-flex; gap: 4px; align-items: center; margin-right: 8px; }
        .asistente-typing span { width: 7px; height: 7px; border-radius: 50%; background: var(--color-text-muted); animation: asistente-bounce 1.2s infinite; }
        .asistente-typing span:nth-child(2) { animation-delay: 0.15s; }
        .asistente-typing span:nth-child(3) { animation-delay: 0.3s; }
        .asistente-typing-label { font-style: normal; color: var(--color-text-muted); font-size: 0.8rem; }
        @keyframes asistente-bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }

        .asistente-error { color: var(--color-danger); font-size: 0.8rem; }

        .asistente-footer { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--color-border); background: var(--color-surface); }
        .asistente-input {
          flex: 1; padding: 10px 12px; border-radius: var(--radius);
          border: 1px solid var(--color-border); background: var(--color-surface-alt); color: var(--color-text); font-size: 0.9rem;
        }
        .asistente-input:focus { outline: none; border-color: var(--color-accent); }
        .asistente-send {
          width: 42px; border-radius: var(--radius); border: none; cursor: pointer;
          background: var(--color-accent); color: #fff; font-size: 1rem;
        }
        .asistente-send:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </>
  )
}
