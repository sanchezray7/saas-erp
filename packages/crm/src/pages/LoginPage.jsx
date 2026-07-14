import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@saas/core'
import { FormField } from '@saas/core'
import { Button } from '@saas/core'
import { Logo } from '@saas/core'
import { alertError } from '@saas/core'

export function LoginPage() {
  const { t } = useTranslation()
  const { signIn, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (err) {
      const msg = err?.message ?? ''
      if (msg.includes('Email not confirmed') || msg.includes('email_not_confirmed')) {
        alertError('Email no verificado', 'Revisa tu bandeja de entrada y haz clic en el enlace de verificación antes de iniciar sesión.')
      } else if (msg.includes('Invalid login credentials')) {
        alertError(t('auth.errorCredenciales'), 'Correo o contraseña incorrectos.')
      } else {
        alertError('Error al iniciar sesión', msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo"><Logo size={32} fallback="📊" /></div>
          <h1 className="auth-title">{t('login.titulo')}</h1>
          <p className="auth-subtitle">{t('login.subtitulo')}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <FormField
            label={t('auth.correo')}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FormField
            label={t('auth.contrasena')}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? t('login.enviando') : t('auth.iniciarSesion')}
          </Button>
        </form>

        <p className="auth-footer">
          {t('login.registrarse')}{' '}
          <Link to="/register">{t('register.crearCuenta')}</Link>
        </p>
      </div>
    </div>
  )
}
