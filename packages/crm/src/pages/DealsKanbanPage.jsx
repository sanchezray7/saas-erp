import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, formatMoney, alertError, notify, MONEDA_POR_PAIS } from '@saas/core'
import { listarDeals, moverDeal } from '../data/deals'
import { listarPipelines } from '../data/pipelines'

const COLD_DAYS = 14

function isCold(lastActivityAt) {
  if (!lastActivityAt) return true
  const diff = (Date.now() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)
  return diff >= COLD_DAYS
}

export function DealsKanbanPage() {
  const { t } = useTranslation()
  const { activeCompanyId, pais } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'USD'
  const [pipelines, setPipelines] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [pipelineId, setPipelineId] = useState('')
  const dragItem = useRef(null)
  const [draggedOverStage, setDraggedOverStage] = useState(null)

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([listarDeals(activeCompanyId), listarPipelines(activeCompanyId)])
      setDeals(d)
      setPipelines(p)
      if (!pipelineId && p.length > 0) setPipelineId(p[0].id)
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, pipelineId])

  useEffect(() => { load() }, [load])

  const currentPipeline = pipelines.find((p) => p.id === pipelineId)
  const stages = currentPipeline?.stages?.sort((a, b) => a.position - b.position) || []

  function getDealsByStage(stageId) {
    return deals
      .filter((d) => d.stage_id === stageId && d.pipeline_id === pipelineId)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
  }

  function handleDragStart(e, deal) {
    dragItem.current = deal
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', deal.id)
  }

  function handleDragOver(e, stageId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDraggedOverStage(stageId)
  }

  function handleDragLeave() {
    setDraggedOverStage(null)
  }

  async function handleDrop(e, targetStageId) {
    e.preventDefault()
    setDraggedOverStage(null)
    const deal = dragItem.current
    dragItem.current = null
    if (!deal || deal.stage_id === targetStageId) return

    const targetDeals = getDealsByStage(targetStageId)
    const newPosition = targetDeals.length

    try {
      await moverDeal(deal.id, targetStageId, newPosition)
      setDeals((prev) =>
        prev.map((d) =>
          d.id === deal.id ? { ...d, stage_id: targetStageId, position: newPosition } : d
        )
      )
      notify(t('deals.movido'))
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  function handleDragEnd() {
    dragItem.current = null
    setDraggedOverStage(null)
  }

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>{t('deals.titulo')}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="form-input"
            style={{ maxWidth: 220 }}
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
          >
            {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Link to="/deals/new"><Button size="sm">{t('deals.nuevo')}</Button></Link>
        </div>
      </div>

      {stages.length === 0 ? (
        <p className="meta" style={{ textAlign: 'center', padding: 32 }}>{t('common.sinDatos')}</p>
      ) : (
        <div className="kanban-board">
          {stages.map((stage) => {
            const stageDeals = getDealsByStage(stage.id)
            return (
              <div
                key={stage.id}
                className={`kanban-column ${draggedOverStage === stage.id ? 'kanban-column--drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                <div className="kanban-column-header" style={{ borderTopColor: stage.color }}>
                  <span className="kanban-column-title">{stage.name}</span>
                  <span className="kanban-column-count">{stageDeals.length}</span>
                </div>
                <div className="kanban-column-body">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      className="kanban-card"
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal)}
                      onDragEnd={handleDragEnd}
                    >
                      <Link to={`/deals/${deal.id}`} className="kanban-card-title">
                        {deal.title}
                        {isCold(deal.last_activity_at) && <span className="badge badge--danger" style={{ fontSize: '0.6rem', marginLeft: 4, verticalAlign: 'middle' }}>❄️</span>}
                      </Link>
                      <div className="kanban-card-meta">
                        <span>{formatMoney(deal.value, moneda)}</span>
                        {deal.probability != null && <span className="kanban-card-prob">{deal.probability}%</span>}
                      </div>
                      <div className="kanban-card-footer">
                        {deal.contact && <span>{deal.contact.name}</span>}
                        {deal.organization && <span>{deal.organization.name}</span>}
                        {!deal.contact && !deal.organization && <span className="meta">-</span>}
                      </div>
                    </div>
                  ))}
                  {stageDeals.length === 0 && (
                    <div className="kanban-card kanban-card--empty">
                      <span className="meta">{t('common.sinDatos')}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <KanbanStyles />
    </div>
  )
}

function KanbanStyles() {
  return (
    <style>{`
      .kanban-board {
        display: flex;
        gap: 16px;
        overflow-x: auto;
        padding: 8px 0 16px;
        min-height: 400px;
      }
      .kanban-column {
        flex: 1;
        min-width: 240px;
        max-width: 320px;
        background: var(--color-surface-2, #f7f7f8);
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        transition: background 0.2s;
      }
      .kanban-column--drag-over {
        background: var(--color-accent-soft, #e8f0fe);
      }
      .kanban-column-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        border-top: 3px solid #6366f1;
        border-radius: 12px 12px 0 0;
      }
      .kanban-column-title {
        font-weight: 600;
        font-size: 0.85rem;
        color: var(--color-text);
      }
      .kanban-column-count {
        background: var(--color-border, #e2e4e8);
        color: var(--color-text-muted);
        font-size: 0.75rem;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 10px;
      }
      .kanban-column-body {
        padding: 8px 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
      }
      .kanban-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 10px 12px;
        cursor: grab;
        transition: box-shadow 0.15s, transform 0.15s;
      }
      .kanban-card:active {
        cursor: grabbing;
      }
      .kanban-card:hover {
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        transform: translateY(-1px);
      }
      .kanban-card--empty {
        cursor: default;
        text-align: center;
        padding: 20px 12px;
        border-style: dashed;
        background: transparent;
      }
      .kanban-card--empty:hover {
        box-shadow: none;
        transform: none;
      }
      .kanban-card-title {
        display: block;
        font-weight: 600;
        font-size: 0.85rem;
        color: var(--color-text);
        text-decoration: none;
        margin-bottom: 6px;
      }
      .kanban-card-title:hover {
        color: var(--color-accent);
      }
      .kanban-card-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--color-text);
        margin-bottom: 4px;
      }
      .kanban-card-prob {
        font-size: 0.7rem;
        font-weight: 400;
        color: var(--color-text-muted);
        background: var(--color-surface-2, #f0f0f2);
        padding: 1px 6px;
        border-radius: 4px;
      }
      .kanban-card-footer {
        font-size: 0.75rem;
        color: var(--color-text-muted);
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      @media (max-width: 768px) {
        .kanban-board {
          overflow-x: visible;
          flex-direction: column;
        }
        .kanban-column {
          min-width: unset;
          max-width: unset;
        }
      }
    `}</style>
  )
}
