import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, FormField, alertError, notify } from '@saas/core'
import { obtenerConfigCobranza, guardarConfigCobranza } from '../data/cobranza'

export function CobranzaConfigForm({ companyId, canEdit, plantillas = [] }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    activo: false,
    dias_antes: 3,
    dias_despues: 1,
    intervalo_dias: 3,
    plantilla_id: '',
  })

  useEffect(() => {
    obtenerConfigCobranza(companyId)
      .then((cfg) => {
        if (cfg) {
          setForm({
            activo: cfg.activo ?? false,
            dias_antes: cfg.dias_antes ?? 3,
            dias_despues: cfg.dias_despues ?? 1,
            intervalo_dias: cfg.intervalo_dias ?? 3,
            plantilla_id: cfg.plantilla_id || '',
          })
        }
      })
      .catch((err) => alertError('Error', err.message))
      .finally(() => setLoading(false))
  }, [companyId])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await guardarConfigCobranza(companyId, {
        activo: form.activo,
        dias_antes: Number(form.dias_antes),
        dias_despues: Number(form.dias_despues),
        intervalo_dias: Number(form.intervalo_dias),
        plantilla_id: form.plantilla_id || null,
      })
      notify(t('common.guardado'))
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="meta" style={{ padding: 16 }}>{t('common.cargando')}</p>

  return (
    <div className="config-table-wrap">
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 500 }}>
        <label className="config-form-check" style={{ fontSize: '0.88rem' }}>
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => set('activo', e.target.checked)}
            disabled={!canEdit}
          />
          Activar cobranza automática por WhatsApp
        </label>

        <p className="meta" style={{ fontSize: '0.78rem', marginTop: -8 }}>
          Al activar, se enviarn recordatorios automáticos a los contactos con facturas pendientes según la configuración.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <FormField
            label="Días ANTES del vencimiento"
            type="number"
            min="0"
            max="30"
            value={form.dias_antes}
            onChange={(e) => set('dias_antes', e.target.value)}
            disabled={!canEdit || !form.activo}
          />
          <FormField
            label="Días DESPUÉS del vencimiento"
            type="number"
            min="0"
            max="30"
            value={form.dias_despues}
            onChange={(e) => set('dias_despues', e.target.value)}
            disabled={!canEdit || !form.activo}
          />
          <FormField
            label="Re-enviar cada (días)"
            type="number"
            min="1"
            max="30"
            value={form.intervalo_dias}
            onChange={(e) => set('intervalo_dias', e.target.value)}
            disabled={!canEdit || !form.activo}
          />
        </div>

        {plantillas.length > 0 && (
          <FormField label="Plantilla WhatsApp (opcional)" as="select" value={form.plantilla_id} onChange={(e) => set('plantilla_id', e.target.value)} disabled={!canEdit || !form.activo}>
            <option value="">— Usar mensaje por defecto —</option>
            {plantillas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </FormField>
        )}

        {canEdit && (
          <div style={{ marginTop: 4 }}>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? t('common.guardando') : t('common.guardar')}
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
