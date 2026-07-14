import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, ConfirmModal, alertError, notify, PERMISSIONS } from '@saas/core'
import { listarContactos, eliminarContacto, importarContactos } from '../data/contacts'
import { ImportCsvModal } from '../components/ImportCsvModal'
import { downloadCSV } from '../lib/exportData'
import { listarTagsDeContacto } from '../data/tags'

const COLD_DAYS = 14

function isCold(lastActivityAt) {
  if (!lastActivityAt) return true
  const diff = (Date.now() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)
  return diff >= COLD_DAYS
}

export function ContactsPage() {
  const { t } = useTranslation()
  const { activeCompanyId } = useAuth()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [contactTagsMap, setContactTagsMap] = useState({})

  const load = useCallback(async () => {
    try {
      const data = await listarContactos(activeCompanyId)
      setContacts(data)
      // Cargar tags de todos los contactos
      const supabase = (await import('@saas/core')).getSupabase()
      const { data: tagsData } = await supabase
        .from('contact_tags')
        .select('contact_id, tag:tag_id(id, nombre, color)')
        .in('contact_id', data.map((c) => c.id))
      if (tagsData) {
        const map = {}
        for (const ct of tagsData) {
          if (!map[ct.contact_id]) map[ct.contact_id] = []
          map[ct.contact_id].push(ct.tag)
        }
        setContactTagsMap(map)
      }
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    try {
      await eliminarContacto(id)
      notify(t('common.eliminado'))
      setContacts((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      alertError('Error', err.message)
    }
    setDeleting(null)
  }

  const filtered = contacts.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q)
  })

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>{t('contacts.titulo')}</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="sm" variant="ghost" onClick={() => setShowImport(true)}>{t('common.importar')}</Button>
          <Button size="sm" variant="ghost" onClick={() => downloadCSV(
            contacts.map((c) => ({ name: c.name, email: c.email, phone: c.phone, position: c.position, source: c.source, notes: c.notes })),
            'contactos.csv'
          )}>{t('common.exportar')}</Button>
          <Link to="/contacts/new"><Button size="sm">{t('contacts.nuevo')}</Button></Link>
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
            <th>{t('contacts.empresa')}</th>
            <th>{t('contacts.asignadoA')}</th>
            <th style={{ width: 80 }}>Score</th>
            <th style={{ width: 120 }}>🏷️</th>
            <th>{t('common.acciones')}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={8} className="meta" style={{ textAlign: 'center', padding: 32 }}>
                {t('common.sinDatos')}
              </td>
            </tr>
          ) : filtered.map((c) => (
            <tr key={c.id}>
              <td data-label={t('contacts.nombre')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Link to={`/contacts/${c.id}`} className="link">{c.name}</Link>
                  {isCold(c.last_activity_at) && <span className="badge badge--danger" style={{ fontSize: '0.65rem' }}>❄️</span>}
                </div>
              </td>
              <td data-label={t('contacts.email')}>{c.email}</td>
              <td data-label={t('contacts.telefono')}>{c.phone}</td>
              <td data-label={t('contacts.empresa')}>{c.organization?.name ?? c.company_name ?? '-'}</td>
              <td data-label={t('contacts.asignadoA')} className="meta">{c.assigned_email || c.assigned_to?.email || '-'}</td>
              <td data-label="Score">
                {c.score != null ? (
                  <span className="badge" style={{
                    fontSize: '0.7rem',
                    padding: '1px 8px',
                    background: c.score >= 67 ? 'var(--color-success)' : c.score >= 34 ? 'var(--color-warning)' : 'var(--color-danger)',
                    color: '#fff',
                  }}>
                    {c.score >= 67 ? '🟢' : c.score >= 34 ? '🟡' : '🔴'} {c.score}
                  </span>
                ) : (
                  <span className="meta" style={{ fontSize: '0.75rem' }}>—</span>
                )}
              </td>
              <td data-label="🏷️">
                {(contactTagsMap[c.id] || []).length > 0 ? (
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {(contactTagsMap[c.id] || []).slice(0, 3).map((tag) => (
                      <span key={tag.id} style={{
                        padding: '0 5px', borderRadius: 999, fontSize: '0.62rem', fontWeight: 600,
                        background: (tag.color || '#6366f1') + '20',
                        color: tag.color || '#6366f1',
                        whiteSpace: 'nowrap',
                      }}>
                        {tag.nombre}
                      </span>
                    ))}
                    {(contactTagsMap[c.id] || []).length > 3 && (
                      <span className="meta" style={{ fontSize: '0.62rem' }}>+{contactTagsMap[c.id].length - 3}</span>
                    )}
                  </div>
                ) : (
                  <span className="meta" style={{ fontSize: '0.72rem' }}>—</span>
                )}
              </td>
              <td data-label="">
                <div style={{ display: 'flex', gap: 4 }}>
                  <Link to={`/contacts/${c.id}/edit`}><Button size="xs" variant="ghost">{t('common.editar')}</Button></Link>
                  <Button size="xs" danger onClick={() => setDeleting(c.id)}>{t('common.eliminar')}</Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && (
        <ConfirmModal
          title={t('contacts.eliminar')}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}

      {showImport && (
        <ImportCsvModal
          entity="contacts"
          onImport={(rows) => importarContactos(activeCompanyId, rows)}
          onClose={() => { setShowImport(false); load() }}
        />
      )}
    </div>
  )
}
