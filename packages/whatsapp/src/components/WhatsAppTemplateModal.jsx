import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, alertError, notify, resolveTemplate } from '@saas/core'

export function WhatsAppTemplateModal({ contact, companyId, onSend, onClose, templates = [], cotizacion, deal, userName, userEmail, userPhone, companyName }) {
  const { t } = useTranslation()
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [message, setMessage] = useState('')

  const phone = contact?.phone || ''
  const isValid = /^\+\d{7,15}$/.test(phone.replace(/\s/g, ''))

  const variables = {
    contacto: {
      nombre: contact?.name || '',
      email: contact?.email || '',
      telefono: contact?.phone || '',
      empresa: contact?.organization?.name || '',
    },
    usuario: {
      nombre: userName || '',
      email: userEmail || '',
      telefono: userPhone || '',
    },
    empresa: {
      nombre: companyName || '',
    },
    cotizacion: cotizacion ? {
      numero: cotizacion.numero || '',
      total: cotizacion.total ? String(cotizacion.total) : '',
      link: cotizacion.link || '',
    } : {},
    deal: deal ? {
      titulo: deal.titulo || '',
      valor: deal.valor ? String(deal.valor) : '',
    } : {},
  }

  // Seleccionar primera plantilla por defecto
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id)
    }
  }, [templates, selectedTemplateId])

  function handleSelectTemplate(id) {
    setSelectedTemplateId(id)
    const tmpl = templates.find((t) => t.id === id)
    if (tmpl) {
      setMessage(resolveTemplate(tmpl.body, variables))
    }
  }

  useEffect(() => {
    if (selectedTemplateId) {
      const tmpl = templates.find((t) => t.id === selectedTemplateId)
      if (tmpl) {
        setMessage(resolveTemplate(tmpl.body, variables))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, JSON.stringify(variables)])

  async function handleSend() {
    if (!message.trim()) return
    try {
      await onSend(message.trim())
      notify('Mensaje WhatsApp enviado')
      onClose()
    } catch (err) {
      alertError('Error al enviar WhatsApp', err.message)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--color-surface)', borderRadius: 12,
        padding: 24, width: '100%', maxWidth: 480,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>📱 WhatsApp</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        <div style={{ marginBottom: 12, fontSize: '0.85rem' }}>
          <span className="meta">Para: </span>
          <span style={{ fontWeight: 600 }}>{contact?.name}</span>
          <span className="meta"> — {phone || 'sin teléfono'}</span>
        </div>

        {!isValid && phone && (
          <p style={{ fontSize: '0.78rem', color: 'var(--color-danger)', marginBottom: 8 }}>
            El teléfono debe estar en formato internacional: +573001234567
          </p>
        )}

        {templates.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 4, color: 'var(--color-text-muted)' }}>Plantilla</label>
            <select className="form-input" value={selectedTemplateId} onChange={(e) => handleSelectTemplate(e.target.value)} style={{ fontSize: '0.82rem' }}>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        {templates.length === 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--color-warning)', marginBottom: 8 }}>
            No hay plantillas WhatsApp. Creá una en Configuración → Plantillas de correo con contexto "WhatsApp".
          </p>
        )}

        <textarea
          className="form-input"
          rows={5}
          placeholder="Escribe tu mensaje..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ width: '100%', resize: 'vertical', marginBottom: 16 }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={onClose}>{t('common.cancelar')}</Button>
          <Button size="sm" onClick={handleSend} disabled={!message.trim() || !isValid}>
            📤 Enviar WhatsApp
          </Button>
        </div>
      </div>
    </div>
  )
}
