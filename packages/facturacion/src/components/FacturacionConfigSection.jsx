import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, FormField, alertError, notify, getSupabase } from '@saas/core'
import { listarActividades } from '../data/actividades'

const PAISES_NOMBRES = { PY: 'Paraguay', AR: 'Argentina', CL: 'Chile', CO: 'Colombia', PE: 'Perú', BR: 'Brasil', MX: 'México' }

function Tooltip({ text, children }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {children}
      <span
        style={{ cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
      >❓</span>
      {show && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 10,
          background: 'var(--color-sidebar)', color: '#fff',
          padding: '8px 12px', borderRadius: 8, fontSize: '0.75rem',
          lineHeight: 1.5, maxWidth: 300, whiteSpace: 'normal',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          marginTop: 4,
        }}>
          {text}
        </div>
      )}
    </span>
  )
}

const TOOLTIPS = {
  timbrado: 'Número de timbrado asignado por la DNIT. Cada factura electrónica debe usar un timbrado vigente. Lo obtenés al habilitarte como facturador electrónico en el Sistema de Gestión de Timbrado (SGTM).',
  establecimiento: 'Código del establecimiento comercial. Generalmente "001" si tenés un solo local.',
  punto_expedicion: 'Código del punto de expedición. Generalmente "001" si emitís facturas desde un solo lugar.',
  csc: 'Código de Seguridad del Contribuyente (CSC). Es una clave alfanumérica que usás para generar el hash del código QR de la factura. Lo obtenés de la DNIT al habilitarte como facturador electrónico.',
  id_csc: 'Identificador del CSC. Generalmente "0001" para el primer código que te asigna la DNIT. Si renovás tu CSC, el Id cambia.',
  actividad_economica: 'Código de la actividad económica principal según la clasificación del MIC. Usá el buscador para encontrar la tuya.',
}

const CAMPOS_POR_PAIS = {
  PY: {
    label: 'SIFEN (e-kuatia) — Paraguay',
    campos: [
      { key: 'ruc_factura', label: 'RUC facturación', span: 1 },
      { key: 'dv_factura', label: 'DV', span: 1 },
      { key: 'timbrado', label: 'Timbrado', span: 1, tooltip: true },
      { key: 'establecimiento', label: 'Establecimiento', span: 1, tooltip: true },
      { key: 'punto_expedicion', label: 'Punto expedición', span: 1, tooltip: true },
      { key: 'csc', label: 'CSC', span: 1, tooltip: true },
      { key: 'id_csc', label: 'Id CSC', span: 1, tooltip: true },
      { key: 'actividad_economica', label: 'Código actividad económica', span: 1, tooltip: true },
      { key: 'des_actividad_economica', label: 'Descripción actividad', span: 2 },
    ],
  },
}

export function FacturacionConfigSection({ companyId, canEdit }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [pais, setPais] = useState('PY')
  const [actividades, setActividades] = useState([])
  const [form, setForm] = useState({})

  useEffect(() => {
    const supabase = getSupabase()
    supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()
      .then(({ data }) => {
        if (data) {
          setPais(data.pais || 'PY')
          setForm(data)
        }
      })
      .catch((err) => alertError('Error', err.message))
      .finally(() => setLoading(false))
    listarActividades().then(setActividades).catch(() => {})
  }, [companyId])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleActividadChange(codigo) {
    set('actividad_economica', codigo)
    const act = actividades.find((a) => a.codigo === codigo)
    if (act) set('des_actividad_economica', act.descripcion)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const supabase = getSupabase()
      const payload = {}
      for (const c of CAMPOS_POR_PAIS[pais]?.campos || []) {
        payload[c.key] = form[c.key] || null
      }
      const { data: result, error } = await supabase.rpc('actualizar_empresa', {
        p_company_id: companyId,
        p_data: payload,
      })
      if (error) throw error
      if (result?.error) throw new Error(result.error)
      notify(t('common.guardado'))
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const config = CAMPOS_POR_PAIS[pais]

  if (loading) return <p className="meta" style={{ padding: 16 }}>{t('common.cargando')}</p>

  if (!config) {
    return (
      <div className="config-table-wrap">
        <p className="meta" style={{ padding: 16 }}>
          ⚠️ La facturación electrónica para {PAISES_NOMBRES[pais] || pais} aún no está disponible.
        </p>
      </div>
    )
  }

  return (
    <div className="config-table-wrap">
      <p className="meta" style={{ marginBottom: 12, fontSize: '0.82rem' }}>
        Configuración para <strong>{config.label}</strong>
      </p>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 600 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {config.campos.map((campo) => (
            <div key={campo.key} style={campo.span === 2 ? { gridColumn: 'span 2' } : campo.span === 3 ? { gridColumn: 'span 3' } : {}}>
              {campo.key === 'actividad_economica' ? (
                <div>
                  <Tooltip text={TOOLTIPS[campo.key] || ''}>
                    <label className="form-label">{campo.label}</label>
                  </Tooltip>
                  <select
                    className="form-input"
                    value={form[campo.key] || ''}
                    onChange={(e) => handleActividadChange(e.target.value)}
                    disabled={!canEdit}
                    style={{ marginTop: 4, width: '100%' }}
                  >
                    <option value="">— Seleccionar —</option>
                    {actividades.map((a) => (
                      <option key={a.codigo} value={a.codigo}>{a.codigo} — {a.descripcion}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <FormField
                  label={
                    campoTooltip(campo) ? (
                      <Tooltip text={TOOLTIPS[campo.key] || ''}>{campo.label}</Tooltip>
                    ) : (
                      campo.label
                    )
                  }
                  value={form[campo.key] || ''}
                  onChange={(e) => set(campo.key, e.target.value)}
                  disabled={!canEdit}
                />
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div style={{ marginTop: 8 }}>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? t('common.guardando') : t('common.guardar')}
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}

function campoTooltip(campo) {
  return campo.tooltip && TOOLTIPS[campo.key]
}
