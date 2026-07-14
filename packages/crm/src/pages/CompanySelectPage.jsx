import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Button, Skeleton, Logo } from '@saas/core'

export function CompanySelectPage() {
  const { t } = useTranslation()
  const { user, companies, selectCompany, signOut, loading, companiesLoading } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState('')

  function handleSelect(e) {
    const id = e.target.value
    if (!id) return
    setSelected(id)
    selectCompany(id)
    navigate('/dashboard', { replace: true })
  }

  if (loading || companiesLoading) return <div className="max-w-[960px] mx-auto p-8"><Skeleton.Card /></div>

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo"><Logo size={32} fallback="📊" /></div>
          <h1 className="auth-title">{t('companySelect.seleccionaEmpresa')}</h1>
          <p className="auth-subtitle">
            {t('companySelect.sesion')} <strong>{user?.email}</strong>
          </p>
        </div>

        {companies.length === 0 ? (
          <>
            <div className="rounded p-3 text-sm mb-4 bg-danger-bg text-danger" role="alert">
              {t('companySelect.sinAsignacion')}
            </div>
            <Link to="/crear-empresa"><Button className="w-full" style={{ marginTop: 8 }}>Crear empresa</Button></Link>
          </>
        ) : (
          <select
            className="form-input"
            value={selected}
            onChange={handleSelect}
            style={{ width: '100%', padding: '12px 14px', fontSize: '0.95rem' }}
          >
            <option value="">— {t('companySelect.seleccionaEmpresa')} —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: '1.25rem' }}>
          <Link to="/crear-empresa" style={{ flex: 1 }}><Button variant="ghost" className="w-full">+ {t('companySelect.crearEmpresa')}</Button></Link>
          <Button variant="ghost" onClick={signOut}>{t('companySelect.cerrarSesion')}</Button>
        </div>
      </div>
    </div>
  )
}
