import { useState, useEffect } from 'react'
import { Button, notify } from '@saas/core'
import { registrarPush } from '../lib/push'

const DISMISS_KEY = 'push_prompt_dismissed'

export function PushPrompt() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'granted') return
    if (Notification.permission === 'denied') return

    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed) {
      const diff = Date.now() - Number(dismissed)
      if (diff < 7 * 24 * 60 * 60 * 1000) return
    }

    const timer = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  async function handleActivar() {
    // Ocultar inmediatamente para mejor UX
    setVisible(false)
    const ok = await registrarPush()
    if (ok) {
      notify('Notificaciones activadas correctamente')
    } else {
      // Si falló pero el permiso fue concedido, igual está bien
      if (Notification.permission === 'granted') {
        notify('Notificaciones activadas')
      }
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999,
      background: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)',
      padding: '12px 16px',
      boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
      display: 'flex', alignItems: 'center', gap: 12,
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: '0.85rem', flex: 1, minWidth: 200 }}>
        Recibí notificaciones de tus clientes en tiempo real
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button size="sm" onClick={handleActivar}>Activar</Button>
        <Button size="sm" variant="ghost" onClick={handleDismiss}>Ahora no</Button>
      </div>
    </div>
  )
}
