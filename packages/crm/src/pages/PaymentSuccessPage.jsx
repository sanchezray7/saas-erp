import { useEffect } from 'react'

export function PaymentSuccessPage() {
  useEffect(() => {
    // Notificar a la ventana padre que el pago fue exitoso
    if (window.opener) {
      window.opener.postMessage('payment-success', '*')
    }
    // Cerrar la ventana después de 2 segundos
    const timer = setTimeout(() => window.close(), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center', padding: 32 }}>
      <div style={{ fontSize: '4rem' }}>✅</div>
      <h1 style={{ margin: 0 }}>Pago exitoso</h1>
      <p style={{ color: 'var(--color-text-muted)', maxWidth: 400, lineHeight: 1.6 }}>
        Tu pago fue procesado correctamente. Esta ventana se cerrará automáticamente.
      </p>
      <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
        Si no se cierra, podés cerrarla manualmente.
      </p>
    </div>
  )
}
