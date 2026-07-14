import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, FormField, Button, notify, alertError } from '@saas/core'
import { guardarOrganizacion, obtenerOrganizacion } from '../data/organizations'
import { listarIndustries } from '../data/industries'
import { consultarRuc } from '../data/rucApi'

export function OrganizationFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeCompanyId } = useAuth()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [buscandoRuc, setBuscandoRuc] = useState(false)
  const [industries, setIndustries] = useState([])
  const [form, setForm] = useState({
    id: null, name: '', ruc: '', direccion: '', email: '', phone: '', website: '', description: '', industry: '',
  })

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    async function init() {
      try {
        const [inds, org] = await Promise.all([
          listarIndustries(activeCompanyId),
          isEdit ? obtenerOrganizacion(id) : null,
        ])
        setIndustries(inds)
        if (org) {
          setForm({
            id: org.id, name: org.name || '', ruc: org.ruc || '', direccion: org.direccion || '',
            email: org.email || '', phone: org.phone || '', website: org.website || '',
            description: org.description || '', industry: org.industry || '',
          })
        }
      } catch (err) {
        alertError('Error', err.message)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id, isEdit, activeCompanyId])

  async function handleBuscarRuc() {
    const ruc = form.ruc.trim()
    if (!ruc) return
    setBuscandoRuc(true)
    try {
      const data = await consultarRuc(ruc)
      if (data.razonSocial) set('name', data.razonSocial)
      if (data.direccion) set('direccion', data.direccion)
      notify(t('organizations.rucEncontrado'))
    } catch (err) {
      alertError('Error', err.message === 'RUC no encontrado' ? t('organizations.rucNoEncontrado') : err.message)
    } finally {
      setBuscandoRuc(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await guardarOrganizacion(activeCompanyId, form)
      notify(isEdit ? t('common.actualizado') : t('common.guardado'))
      navigate('/organizations')
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="card" style={{ maxWidth: 560 }}><p className="meta">Cargando...</p></div>

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="page-header">
        <h1>{isEdit ? t('organizations.editar') : t('organizations.nuevo')}</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label={t('organizations.nombre')} required value={form.name} onChange={(e) => set('name', e.target.value)} />

        <div className="frm">
          <label className="frm-label">{t('organizations.ruc')}</label>
          <div style={{ display: 'flex' }}>
            <input
              className="frm-input"
              style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
              value={form.ruc}
              onChange={(e) => set('ruc', e.target.value)}
              placeholder="80012345-5"
            />
            <button
              type="button"
              onClick={handleBuscarRuc}
              disabled={buscandoRuc || !form.ruc.trim()}
              style={{
                padding: '10px 14px',
                fontSize: '0.82rem',
                fontWeight: 500,
                border: '1px solid var(--color-border)',
                borderLeft: 'none',
                borderTopRightRadius: 'var(--radius)',
                borderBottomRightRadius: 'var(--radius)',
                background: 'var(--color-surface)',
                color: buscandoRuc || !form.ruc.trim() ? 'var(--color-text-soft)' : 'var(--color-accent)',
                cursor: buscandoRuc || !form.ruc.trim() ? 'not-allowed' : 'pointer',
                opacity: buscandoRuc || !form.ruc.trim() ? 0.5 : 1,
                transition: 'background 0.15s, opacity 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--color-surface-alt)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-surface)'
              }}
            >
              {buscandoRuc ? '…' : t('organizations.buscarRuc')}
            </button>
          </div>
        </div>

        <FormField label={t('organizations.direccion')} value={form.direccion} onChange={(e) => set('direccion', e.target.value)} />
        <FormField label={t('organizations.email')} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        <FormField label={t('organizations.telefono')} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        <FormField label="Website" type="url" value={form.website} onChange={(e) => set('website', e.target.value)} />
        <FormField label={t('organizations.industria')} as="select" value={form.industry} onChange={(e) => set('industry', e.target.value)}>
          <option value="">—</option>
          {industries.map((ind) => <option key={ind.id} value={ind.name}>{ind.name}</option>)}
        </FormField>
        <FormField label={t('organizations.descripcion')} as="textarea" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button type="submit" disabled={submitting}>{submitting ? t('common.guardando') : t('common.guardar')}</Button>
          <Button variant="ghost" onClick={() => navigate('/organizations')}>{t('common.cancelar')}</Button>
        </div>
      </form>
    </div>
  )
}
