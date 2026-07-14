import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@saas/core'
import { FormField } from '@saas/core'
import { Button } from '@saas/core'
import { Logo } from '@saas/core'
import { alertError } from '@saas/core'

export function CreateCompanyPage() {
  const { t } = useTranslation()
  const { createCompanyAndSelect } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(false)

  useEffect(() => {
    if (created) {
      navigate('/dashboard', { replace: true })
    }
  }, [created, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await createCompanyAndSelect(name.trim())
      setCreated(true)
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo"><Logo size={32} fallback="📊" /></div>
          <h1 className="auth-title">{t('companySelect.crearEmpresa')}</h1>
          <p className="auth-subtitle">{t('companySelect.crearDescripcion')}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <FormField
            label={t('companySelect.nombreEmpresa')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? t('companySelect.creando') : t('companySelect.crearBtn')}
          </Button>
        </form>
      </div>
    </div>
  )
}
