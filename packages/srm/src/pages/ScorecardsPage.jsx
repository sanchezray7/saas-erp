import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, FormField, confirmAction, alertError, notify } from '@saas/core'
import { obtenerScorecards, calcularScorecards, guardarScorecardManual } from '../data/scorecard'

function ScoreBar({ value, max = 5, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  const bg = color || (pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: bg, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontWeight: 700, fontSize: '0.82rem', minWidth: 32, textAlign: 'right' }}>{Number(value).toFixed(1)}</span>
    </div>
  )
}

function Stars({ value }) {
  const full = Math.round(value)
  return <span>{'★'.repeat(Math.max(0, full))}{'☆'.repeat(Math.max(0, 5 - full))}</span>
}

function EditScorecardModal({ scorecard, onClose, onSaved }) {
  const [calidad, setCalidad] = useState(scorecard?.calidad || 0)
  const [comunicacion, setComunicacion] = useState(scorecard?.comunicacion || 0)
  const [notas, setNotas] = useState(scorecard?.notas || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await guardarScorecardManual(scorecard.id, calidad, comunicacion, notas)
      notify('Scorecard actualizado')
      onSaved()
      onClose()
    } catch (err) { alertError('Error', err.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 420, margin: 16 }} onClick={(e) => e.stopPropagation()}>
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Editar scorecard</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>
        <p className="meta" style={{ marginBottom: 12 }}>{scorecard?.proveedor_nombre}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="Calidad (1-5)" type="number" min="0" max="5" step="0.5" value={calidad} onChange={(e) => setCalidad(Number(e.target.value))} />
          <FormField label="Comunicación (1-5)" type="number" min="0" max="5" step="0.5" value={comunicacion} onChange={(e) => setComunicacion(Number(e.target.value))} />
          <FormField label="Notas internas" as="textarea" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </div>
    </div>
  )
}

export function ScorecardsPage() {
  const { t } = useTranslation()
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [calculando, setCalculando] = useState(false)
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await obtenerScorecards(activeCompanyId)
      setData(d)
    } catch (err) { alertError('Error', err.message) }
    finally { setLoading(false) }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleRecalcular() {
    if (!await confirmAction({ title: 'Recalcular', text: '¿Recalcular scorecards con datos actuales?' })) return
    setCalculando(true)
    try {
      await calcularScorecards(activeCompanyId)
      notify('Scorecards recalculados')
      load()
    } catch (err) { alertError('Error', err.message) }
    finally { setCalculando(false) }
  }

  const filtered = data.filter((s) => {
    if (!search) return true
    return s.proveedor_nombre?.toLowerCase().includes(search.toLowerCase())
  })

  function bgColor(score) {
    if (score >= 4) return '#dcfce7'
    if (score >= 3) return '#fef3c7'
    return '#fef2f2'
  }

  function textColor(score) {
    if (score >= 4) return '#16a34a'
    if (score >= 3) return '#d97706'
    return '#dc2626'
  }

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>📊 Scorecard proveedores</h1>
        <Button size="sm" onClick={handleRecalcular} disabled={calculando}>
          {calculando ? 'Calculando...' : '🔄 Recalcular'}
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input type="search" placeholder="Buscar proveedor..." className="form-input" style={{ width: '100%', maxWidth: 320 }} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <p className="meta" style={{ textAlign: 'center', padding: 32 }}>
          {data.length === 0 ? 'Sin datos. Presioná "Recalcular" para generar los scorecards.' : 'Sin resultados'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((s) => {
            const general = Number(s.puntaje_general)
            return (
              <div key={s.id} style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
                padding: '12px 16px', background: bgColor(general), borderRadius: 'var(--radius)',
                border: `1px solid ${textColor(general)}30`,
              }}>
                <div style={{ flex: '1 1 180px', minWidth: 150 }}>
                  <Link to={`/proveedores/${s.proveedor_id}`} className="link" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    {s.proveedor_nombre}
                  </Link>
                  <div className="meta" style={{ fontSize: '0.75rem' }}>{s.proveedor_categoria || ''} · {s.total_evaluaciones || 0} eval.</div>
                </div>

                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: textColor(general), minWidth: 50, textAlign: 'center' }}>
                  <Stars value={general} />
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{general.toFixed(1)}</div>
                </div>

                <div style={{ flex: '3 1 300px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
                  <ScoreBar value={s.entrega_tiempo} label="⏱ Entrega" />
                  <ScoreBar value={s.precision_cantidad} label="📦 Cantidad" />
                  <ScoreBar value={s.precision_precio} label="💰 Precio" />
                </div>

                <div style={{ flex: '1 1 120px', minWidth: 100, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem' }}>
                  <div>👍 Calidad: <strong>{Number(s.calidad).toFixed(1)}</strong></div>
                  <div>💬 Comun.: <strong>{Number(s.comunicacion).toFixed(1)}</strong></div>
                </div>

                <div>
                  <Button size="xs" variant="ghost" onClick={() => setEditTarget(s)}>Editar</Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editTarget && (
        <EditScorecardModal scorecard={editTarget} onClose={() => setEditTarget(null)} onSaved={load} />
      )}
    </div>
  )
}
