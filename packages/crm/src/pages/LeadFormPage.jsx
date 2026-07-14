import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getSupabase } from '@saas/core'
import { obtenerEmpresaPorToken } from '../data/leads'

export function LeadFormPage() {
  const { token } = useParams()
  const [empresa, setEmpresa] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })

  useEffect(() => {
    if (!token) return
    obtenerEmpresaPorToken(token)
      .then((data) => {
        if (!data?.name) throw new Error('Link inválido o desactivado')
        setEmpresa(data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return
    setSending(true)
    try {
      const supabase = getSupabase()
      await supabase.functions.invoke('form-webhook', {
        body: {
          token,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          message: form.message.trim() || undefined,
        },
      })
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', padding: 20, textAlign: 'center' }}>
        <p style={{ color: '#6b7280' }}>Cargando...</p>
      </div>
    )
  }

  if (error && !empresa) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔗</div>
        <h1 style={{ fontSize: '1.2rem', margin: '0 0 8px', color: '#111827' }}>Link inválido</h1>
        <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>{error}</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
        <h1 style={{ fontSize: '1.3rem', margin: '0 0 8px', color: '#111827' }}>¡Gracias por contactarnos!</h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Hemos recibido tu mensaje y te responderemos a la brevedad.
        </p>
        <p style={{ color: '#9ca3af', fontSize: '0.78rem', marginTop: 20 }}>
          {empresa?.name || ''}
        </p>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f3f4f6',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 32,
        width: '100%', maxWidth: 440,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 4 }}>
            Contactar a
          </div>
          <h1 style={{ fontSize: '1.3rem', margin: 0, color: '#111827' }}>
            {empresa?.name || 'Empresa'}
          </h1>
        </div>

        {error && (
          <div style={{
            padding: '8px 12px', background: '#fef2f2', color: '#dc2626',
            borderRadius: 8, fontSize: '0.82rem', marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Nombre <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              className="form-input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              placeholder="Tu nombre"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Email <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              className="form-input"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              required
              placeholder="tu@email.com"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Teléfono
            </label>
            <input
              className="form-input"
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+595 981 234 567"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Mensaje
            </label>
            <textarea
              className="form-input"
              rows={3}
              value={form.message}
              onChange={(e) => set('message', e.target.value)}
              placeholder="¿En qué podemos ayudarte?"
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            style={{
              marginTop: 8, padding: '10px 20px', border: 'none', borderRadius: 8,
              background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: '0.9rem',
              cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? 'Enviando...' : 'Enviar mensaje'}
          </button>
        </form>
      </div>
    </div>
  )
}
