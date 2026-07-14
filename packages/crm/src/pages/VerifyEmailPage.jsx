import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@saas/core'
import { getSupabase } from '@saas/core'
import { Button } from '@saas/core'
import { notify, alertError } from '@saas/core'

export function VerifyEmailPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (user?.email_confirmed_at) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

  async function handleResend() {
    if (!user?.email) return
    setResending(true)
    try {
      const supabase = getSupabase()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      })
      if (error) throw error
      notify('Email de verificación reenviado')
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">📧</div>
          <h1 className="auth-title">{t('verify.titulo')}</h1>
          <p className="auth-subtitle">{t('verify.descripcion')}</p>
        </div>

        <p className="text-center text-sm text-text-muted" style={{ marginBottom: 20 }}>
          {t('verify.enviadoA')} <strong>{user?.email}</strong>
        </p>

        <Button
          type="button"
          className="w-full"
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? t('verify.reenviando') : t('verify.reenviar')}
        </Button>
      </div>
    </div>
  )
}
