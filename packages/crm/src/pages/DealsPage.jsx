import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, ConfirmModal, alertError, notify, formatMoney, MONEDA_POR_PAIS } from '@saas/core'
import { listarDeals, eliminarDeal, importarDeals } from '../data/deals'
import { listarPipelines } from '../data/pipelines'
import { DealsKanbanPage } from './DealsKanbanPage'
import { ImportCsvModal } from '../components/ImportCsvModal'
import { downloadCSV } from '../lib/exportData'

export function DealsPage() {
  const { t } = useTranslation()
  const [view, setView] = useState('kanban')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div className="view-toggle">
          <button type="button" className={`view-toggle-btn ${view === 'kanban' ? 'active' : ''}`} onClick={() => setView('kanban')}>📋 Kanban</button>
          <button type="button" className={`view-toggle-btn ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>📊 {t('deals.lista')}</button>
        </div>
      </div>
      {view === 'kanban' ? <DealsKanbanPage /> : <DealsTableView />}
      <style>{`
        .view-toggle { display: inline-flex; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }
        .view-toggle-btn { background: none; border: none; padding: 6px 14px; cursor: pointer; font-size: 0.8rem; color: var(--color-text-muted); transition: all 0.15s; }
        .view-toggle-btn.active { background: var(--color-accent); color: #fff; font-weight: 600; }
        .view-toggle-btn:not(.active):hover { background: var(--color-surface-2); }
      `}</style>
    </div>
  )
}

const COLD_DAYS = 14

function isCold(lastActivityAt) {
  if (!lastActivityAt) return true
  const diff = (Date.now() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)
  return diff >= COLD_DAYS
}

function DealsTableView() {
  const { t } = useTranslation()
  const { activeCompanyId, pais } = useAuth()
  const moneda = MONEDA_POR_PAIS[pais] || 'USD'
  const [deals, setDeals] = useState([])
  const [pipelines, setPipelines] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([listarDeals(activeCompanyId), listarPipelines(activeCompanyId)])
      setDeals(d)
      setPipelines(p)
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    try {
      await eliminarDeal(id)
      notify(t('common.eliminado'))
      setDeals((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      alertError('Error', err.message)
    }
    setDeleting(null)
  }

  const allStages = pipelines.flatMap((p) => p.stages || [])

  const filtered = deals.filter((d) => {
    const q = search.toLowerCase()
    if (q && !d.title?.toLowerCase().includes(q) && !d.contact?.name?.toLowerCase().includes(q) && !d.organization?.name?.toLowerCase().includes(q)) return false
    if (filterStage && d.stage_id !== filterStage) return false
    return true
  })

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>{t('deals.titulo')}</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="sm" variant="ghost" onClick={() => setShowImport(true)}>{t('common.importar')}</Button>
          <Button size="sm" variant="ghost" onClick={() => downloadCSV(
            deals.map((d) => ({ title: d.title, value: d.value, stage: d.stage?.name, contact: d.contact?.name, organization: d.organization?.name, notes: d.notes })),
            'oportunidades.csv'
          )}>{t('common.exportar')}</Button>
          <Link to="/deals/new"><Button size="sm">{t('deals.nuevo')}</Button></Link>
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="search" placeholder={t('common.buscar')} className="form-input" style={{ maxWidth: 320 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="form-input" style={{ maxWidth: 200 }} value={filterStage} onChange={(e) => setFilterStage(e.target.value)}>
          <option value="">{t('deals.todasEtapas')}</option>
          {allStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>{t('deals.titulo')}</th>
            <th>{t('deals.valor')}</th>
            <th>{t('deals.etapa')}</th>
            <th>{t('deals.contacto')}</th>
            <th>{t('deals.empresa')}</th>
            <th>{t('common.acciones')}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={6} className="meta" style={{ textAlign: 'center', padding: 32 }}>
                {t('common.sinDatos')}
              </td>
            </tr>
          ) : filtered.map((d) => (
            <tr key={d.id}>
              <td data-label={t('deals.nombre')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Link to={`/deals/${d.id}`} className="link">{d.title}</Link>
                  {isCold(d.last_activity_at) && <span className="badge badge--danger" style={{ fontSize: '0.65rem' }}>❄️</span>}
                </div>
              </td>
              <td data-label={t('deals.valor')}>{formatMoney(d.value, moneda)}</td>
              <td data-label={t('deals.etapa')}>
                <span className="badge" style={{ background: d.stage?.color || '#6366f1', color: '#fff' }}>
                  {d.stage?.name || '-'}
                </span>
              </td>
              <td data-label={t('deals.contacto')}>{d.contact?.name || '-'}</td>
              <td data-label={t('deals.probabilidad')}>{d.organization?.name || '-'}</td>
              <td data-label="">
                <div style={{ display: 'flex', gap: 4 }}>
                  <Link to={`/deals/${d.id}/edit`}><Button size="xs" variant="ghost">{t('common.editar')}</Button></Link>
                  <Button size="xs" danger onClick={() => setDeleting(d.id)}>{t('common.eliminar')}</Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && (
        <ConfirmModal
          title={t('deals.eliminar')}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}

      {showImport && (
        <ImportCsvModal
          entity="deals"
          onImport={(rows) => importarDeals(activeCompanyId, rows)}
          onClose={() => { setShowImport(false); load() }}
        />
      )}
    </div>
  )
}
