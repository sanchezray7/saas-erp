import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getSupabase, FormField, Button, Logo, alertError, notify, validarTaxId } from '@saas/core'
import { listarPaises, getPaisMap } from '../data/paises'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 6
const COOLDOWN_SECONDS = 60

export function RegisterPage() {
  const { t } = useTranslation()

  const [step, setStep] = useState('form')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [rif, setRif] = useState('')
  const [pais, setPais] = useState('PY')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [paisesList, setPaisesList] = useState([])
  const [paisesMap, setPaisesMap] = useState({})

  useEffect(() => {
    listarPaises().then((data) => {
      setPaisesList(data)
      setPaisesMap(getPaisMap(data))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((v) => v - 1), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  const resend = useCallback(async (emailAddr) => {
    const supabase = getSupabase()
    setResending(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email: emailAddr })
    setResending(false)
    if (error) {
      const msg = error.message?.toLowerCase() ?? ''
      if (msg.includes('rate limit') || msg.includes('rate_limit')) {
        setCooldown(120)
        return
      }
      alertError(t('register.errorCrear'), error.message)
      return
    }
    notify(t('register.verificacionReenviada'))
    setCooldown(COOLDOWN_SECONDS)
  }, [t])

  async function handleSubmit(e) {
    e.preventDefault()

    if (!companyName.trim()) {
      alertError(t('register.datosInvalidos'), t('register.errorNombreRequerido'))
      return
    }
    if (!rif.trim()) {
      alertError(t('register.datosInvalidos'), t('register.errorRifRequerido'))
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      alertError(t('register.datosInvalidos'), t('register.errorEmailInvalido'))
      return
    }
    if (password.length < MIN_PASSWORD) {
      alertError(t('register.datosInvalidos'), t('register.errorPasswordCorto'))
      return
    }
    if (password !== confirm) {
      alertError(t('register.datosInvalidos'), t('register.errorPasswordNoCoincide'))
      return
    }

    setSubmitting(true)

    const emailTrim = email.trim()
    const supabase = getSupabase()
    const result = await supabase.functions.invoke('company-signup', {
      body: {
        company_name: companyName.trim(),
        rif: rif.trim(),
        email: emailTrim,
        password,
        pais,
      },
    })

    if (result.error) {
      let msg = t('register.errorCrear')
      try {
        const body = await result.error.context?.json?.()
        if (body?.code === 'email_exists') {
          msg = t('register.errorEmailExiste')
        } else if (body?.code === 'rif_exists') {
          msg = t('register.errorRifExiste')
        } else if (body?.error) {
          msg = body.error
        }
      } catch {
        //
      }
      alertError(t('register.errorCrear'), msg)
      setSubmitting(false)
      return
    }

    setEmail(emailTrim)
    setCooldown(COOLDOWN_SECONDS)
    setSubmitting(false)
    setStep('verify')
  }

  if (step === 'verify') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">📧</div>
            <h1 className="auth-title">{t('register.titulo')}</h1>
          </div>
          <p
            className="auth-subtitle"
            dangerouslySetInnerHTML={{ __html: t('register.exitoVerificar', { email }) }}
          />
          <p className="text-sm text-center" style={{ marginBlock: '1rem', color: 'var(--text-muted)' }}>
            {t('register.noRecibiste')}
          </p>
          <Button
            type="button"
            className="w-full"
            onClick={() => resend(email)}
            disabled={resending || cooldown > 0}
          >
            {resending
              ? t('register.reenviando')
              : cooldown > 0
                ? t('register.cooldown', { s: cooldown })
                : t('register.reenviar')}
          </Button>
          <p className="auth-footer" style={{ marginTop: '1.5rem' }}>
            <Link to="/login">{t('register.iniciarSesion')}</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo"><Logo size={32} fallback="📊" /></div>
          <h1 className="auth-title">{t('register.titulo')}</h1>
          <p className="auth-subtitle">{t('register.subtitulo')}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <FormField
            label={t('register.nombreEmpresa')}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            autoFocus
          />
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">{t('register.pais')}</label>
            <select className="form-input" value={pais} onChange={(e) => { setPais(e.target.value); setRif('') }} required style={{ marginTop: 4 }}>
              {paisesList.map((p) => (
                <option key={p.codigo} value={p.codigo}>{p.bandera} {p.nombre}</option>
              ))}
            </select>
          </div>
          <FormField
            label={paisesMap[pais]?.tax_id_label || t('register.rif')}
            value={rif}
            onChange={(e) => setRif(e.target.value)}
            required
          />
          <FormField
            label={t('register.correo')}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FormField
            label={t('register.contrasena')}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD}
          />
          <FormField
            label={t('register.confirmarContrasena')}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={MIN_PASSWORD}
          />
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? t('register.creando') : t('register.crearCuenta')}
          </Button>
        </form>

        <p className="auth-footer">
          {t('register.yaTienesCuenta')}{' '}
          <Link to="/login">{t('auth.iniciarSesion')}</Link>
        </p>
      </div>
    </div>
  )
}
