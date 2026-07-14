import { useState, useEffect } from 'react'
import { Button, notify } from '@saas/core'

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Verificar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      notify('App instalada')
      setVisible(false)
    }
    setDeferredPrompt(null)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', top: 8, right: 8, zIndex: 999,
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: '0.82rem',
    }}>
      <span style={{ fontWeight: 600 }}>📲 Instalar app</span>
      <Button size="xs" onClick={handleInstall}>Instalar</Button>
      <button
        onClick={() => setVisible(false)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--color-text-muted)', padding: 0, lineHeight: 1 }}
      >✕</button>
    </div>
  )
}
