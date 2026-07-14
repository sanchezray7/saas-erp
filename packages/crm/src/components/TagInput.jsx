import { useState, useEffect, useRef } from 'react'
import { listarTags, crearTag, obtenerTagPorNombre, asignarTagAContacto, quitarTagDeContacto } from '../data/tags'
import { alertError } from '@saas/core'

const TAG_COLORS = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6', '#f97316']

export function TagInput({ companyId, contactId, selectedTags = [], onChange }) {
  const [tags, setTags] = useState([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(true)
  const ref = useRef(null)

  useEffect(() => {
    listarTags(companyId).then(setTags).catch(() => {}).finally(() => setLoading(false))
  }, [companyId])

  useEffect(() => {
    if (!input.trim()) { setSuggestions([]); return }
    const q = input.toLowerCase()
    const filtered = tags.filter(
      (t) => t.nombre.toLowerCase().includes(q) && !selectedTags.find((st) => st.id === t.id)
    )
    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0 || input.trim().length > 0)
  }, [input, tags, selectedTags])

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (input.trim()) handleAddTag(input.trim())
    }
    if (e.key === 'Backspace' && !input && selectedTags.length > 0) {
      handleRemoveTag(selectedTags[selectedTags.length - 1])
    }
  }

  async function handleAddTag(nombre) {
    try {
      const trimmed = nombre.trim()
      if (!trimmed || selectedTags.find((t) => t.nombre.toLowerCase() === trimmed.toLowerCase())) {
        setInput('')
        return
      }
      let tag = await obtenerTagPorNombre(companyId, trimmed)
      if (!tag) {
        const color = TAG_COLORS[tags.length % TAG_COLORS.length]
        tag = await crearTag(companyId, trimmed, color)
        setTags((prev) => [...prev, tag])
      }
      if (contactId) {
        await asignarTagAContacto(contactId, tag.id)
      }
      onChange([...selectedTags, tag])
      setInput('')
      setShowSuggestions(false)
    } catch (err) {
      alertError('Error al agregar etiqueta', err.message)
    }
  }

  async function handleRemoveTag(tag) {
    try {
      if (contactId) {
        await quitarTagDeContacto(contactId, tag.id)
      }
      onChange(selectedTags.filter((t) => t.id !== tag.id))
    } catch (err) {
      alertError('Error al quitar etiqueta', err.message)
    }
  }

  function handleSuggestionClick(tag) {
    handleAddTag(tag.nombre)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 8px',
        border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
        background: 'var(--color-surface)', minHeight: 38, cursor: 'text',
        alignItems: 'center',
      }} onClick={() => ref.current?.querySelector('input')?.focus()}>
        {selectedTags.map((tag) => (
          <span key={tag.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
            background: (tag.color || '#6366f1') + '20',
            color: tag.color || '#6366f1',
            border: `1px solid ${(tag.color || '#6366f1') + '40'}`,
          }}>
            {tag.nombre}
            <button type="button" onClick={() => handleRemoveTag(tag)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.85rem', lineHeight: 1, color: 'inherit', opacity: 0.6 }}
            >✕</button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => input.trim() && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={selectedTags.length === 0 ? 'Escribí una etiqueta y presioná Enter...' : ''}
          style={{
            border: 'none', outline: 'none', flex: 1, minWidth: 80, fontSize: '0.82rem',
            background: 'transparent', color: 'var(--color-text)',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {showSuggestions && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          marginTop: 4, background: 'var(--color-surface)',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          maxHeight: 180, overflow: 'auto',
        }}>
          {suggestions.length > 0 ? suggestions.map((tag) => (
            <div key={tag.id}
              onMouseDown={() => handleSuggestionClick(tag)}
              style={{
                padding: '6px 12px', cursor: 'pointer', fontSize: '0.82rem',
                display: 'flex', alignItems: 'center', gap: 8,
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: tag.color || '#6366f1', display: 'inline-block' }} />
              {tag.nombre}
            </div>
          )) : (
            <div style={{ padding: '6px 12px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              Presioná Enter para crear "{input}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}
