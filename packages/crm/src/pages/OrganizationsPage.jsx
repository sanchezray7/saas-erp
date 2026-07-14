import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, ConfirmModal, alertError, notify, PERMISSIONS } from '@saas/core'
import { listarOrganizaciones, eliminarOrganizacion, importarOrganizaciones } from '../data/organizations'
import { ImportCsvModal } from '../components/ImportCsvModal'
import { downloadCSV } from '../lib/exportData'

export function OrganizationsPage() {
  const { t } = useTranslation()
  const { activeCompanyId } = useAuth()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await listarOrganizaciones(activeCompanyId)
      setOrgs(data)
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    try {
      await eliminarOrganizacion(id)
      notify(t('common.eliminado'))
      setOrgs((prev) => prev.filter((o) => o.id !== id))
    } catch (err) {
      alertError('Error', err.message)
    }
    setDeleting(null)
  }

  const filtered = orgs.filter((o) => {
    if (!search) return true
    const q = search.toLowerCase()
    return o.name?.toLowerCase().includes(q) || o.email?.toLowerCase().includes(q) || o.phone?.includes(q) || o.ruc?.includes(q)
  })

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>{t('organizations.titulo')}</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="sm" variant="ghost" onClick={() => setShowImport(true)}>{t('common.importar')}</Button>
          <Button size="sm" variant="ghost" onClick={() => downloadCSV(
            orgs.map((o) => ({ name: o.name, ruc: o.ruc, email: o.email, phone: o.phone, website: o.website, industry: o.industry, description: o.description })),
            'organizaciones.csv'
          )}>{t('common.exportar')}</Button>
          <Link to="/organizations/new"><Button size="sm">{t('organizations.nuevo')}</Button></Link>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input type="search" placeholder={t('common.buscar')} className="form-input" style={{ width: '100%', maxWidth: 320 }} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>RUC</th>
            <th>{t('organizations.nombre')}</th>
            <th>{t('organizations.email')}</th>
            <th>{t('organizations.telefono')}</th>
            <th>{t('organizations.descripcion')}</th>
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
          ) : filtered.map((o) => (
            <tr key={o.id}>
              <td data-label={t('organizations.ruc')} style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{o.ruc || '-'}</td>
              <td data-label={t('organizations.nombre')}><Link to={`/organizations/${o.id}/edit`} className="link">{o.name}</Link></td>
              <td data-label={t('organizations.email')}>{o.email}</td>
              <td data-label={t('organizations.telefono')}>{o.phone}</td>
              <td data-label={t('organizations.descripcion')}>{o.description ? `${o.description.slice(0, 60)}${o.description.length > 60 ? '…' : ''}` : '-'}</td>
              <td data-label="">
                <div style={{ display: 'flex', gap: 4 }}>
                  <Link to={`/organizations/${o.id}/edit`}><Button size="xs" variant="ghost">{t('common.editar')}</Button></Link>
                  <Button size="xs" danger onClick={() => setDeleting(o.id)}>{t('common.eliminar')}</Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && (
        <ConfirmModal
          title={t('organizations.eliminar')}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}

      {showImport && (
        <ImportCsvModal
          entity="organizations"
          onImport={(rows) => importarOrganizaciones(activeCompanyId, rows)}
          onClose={() => { setShowImport(false); load() }}
        />
      )}
    </div>
  )
}
