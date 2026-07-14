import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, ConfirmModal, alertError, notify } from '@saas/core'
import { listarLeads, asignarLead, convertirLead } from '../data/leads'
import { listarMiembros } from '../data/roundRobin'

export function LeadsPage() {
  const { t } = useTranslation()
  const { activeCompanyId } = useAuth()
  const [leads, setLeads] = useState([])
  const [miembros, setMiembros] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [assigning, setAssigning] = useState(null)
  const [assignUserId, setAssignUserId] = useState('')

  const load = useCallback(async () => {
    try {
      const [data, users] = await Promise.all([
        listarLeads(activeCompanyId),
        listarMiembros(activeCompanyId).catch(() => []),
      ])
      setLeads(data)
      setMiembros(users)
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    try {
      const supabase = getSupabase()
      await supabase.from('contacts').delete().eq('id', id)
      notify(t('common.eliminado'))
      setLeads((prev) => prev.filter((l) => l.id !== id))
    } catch (err) {
      alertError('Error', err.message)
    }
    setDeleting(null)
  }

  async function handleConvert(id) {
    try {
      await convertirLead(id)
      notify('Lead convertido a contacto')
      setLeads((prev) => prev.filter((l) => l.id !== id))
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  async function handleAssign(leadId) {
    if (!assignUserId) return
    try {
      await asignarLead(leadId, assignUserId)
      notify('Lead asignado')
      setAssigning(null)
      setAssignUserId('')
      load()
    } catch (err) {
      alertError('Error', err.message)
    }
  }

  const filtered = leads.filter((l) => {
    if (!search) return true
    const q = search.toLowerCase()
    return l.name?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || l.phone?.includes(q)
  })

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>📩 Leads</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="meta" style={{ alignSelf: 'center' }}>{leads.length} lead{leads.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input type="search" placeholder={t('common.buscar')} className="form-input" style={{ width: '100%', maxWidth: 320 }} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>{t('contacts.nombre')}</th>
            <th>{t('contacts.email')}</th>
            <th>{t('contacts.telefono')}</th>
            <th>Fuente</th>
            <th>Asignado</th>
            <th>{t('common.fecha')}</th>
            <th style={{ width: 180 }}>{t('common.acciones')}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={7} className="meta" style={{ textAlign: 'center', padding: 32 }}>
                {t('common.sinDatos')}
              </td>
            </tr>
          ) : filtered.map((l) => (
            <tr key={l.id}>
              <td data-label={t('contacts.nombre')}>
                <Link to={`/contacts/${l.id}`} className="link">{l.name}</Link>
              </td>
              <td data-label={t('contacts.email')}>{l.email || '-'}</td>
              <td data-label={t('contacts.telefono')}>{l.phone || '-'}</td>
              <td data-label="Fuente"><span className="badge" style={{ fontSize: '0.7rem' }}>{l.source || '—'}</span></td>
              <td data-label="Asignado" className="meta">
                {assigning === l.id ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <select className="form-input" style={{ fontSize: '0.78rem', padding: '2px 4px' }} value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                      <option value="">—</option>
                      {miembros.map((m) => <option key={m.user_id} value={m.user_id}>{m.email || m.user_id.slice(0, 8)}</option>)}
                    </select>
                    <Button size="xs" onClick={() => handleAssign(l.id)}>OK</Button>
                    <Button size="xs" variant="ghost" onClick={() => { setAssigning(null); setAssignUserId('') }}>{t('common.cancelar')}</Button>
                  </div>
                ) : (
                  <span>{l.assigned_email || '-'}</span>
                )}
              </td>
              <td data-label={t('common.fecha')} className="meta">{l.created_at?.slice(0, 10) || '-'}</td>
              <td data-label="">
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button size="xs" variant="ghost" onClick={() => handleConvert(l.id)}>V Convertir</Button>
                  <Button size="xs" variant="ghost" onClick={() => { setAssigning(l.id); setAssignUserId('') }}>?? Asignar</Button>
                  <Button size="xs" danger onClick={() => setDeleting(l.id)}>{t('common.eliminar')}</Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && (
        <ConfirmModal
          title="Eliminar lead"
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
