import { useState, useEffect } from 'react'
import { getSupabase } from '../lib/supabase'

const FEATURES_FALLBACK = {
  catalogo: { enabled: true, plan: null },
  crm: { enabled: true, plan: null },
  facturacion: { enabled: true, plan: null },
  notas_cd: { enabled: false, plan: 'starter' },
  srm: { enabled: false, plan: 'starter' },
  inventario: { enabled: false, plan: 'starter' },
  contabilidad: { enabled: false, plan: 'starter' },
  contabilidad_avanzada: { enabled: false, plan: 'business' },
  asientos_automaticos_facturas: { enabled: false, plan: 'starter' },
  asientos_automaticos_nomina: { enabled: false, plan: 'business' },
  rrhh: { enabled: false, plan: 'business' },
  nomina: { enabled: false, plan: 'business' },
  whatsapp: { enabled: false, plan: 'business' },
  reportes: { enabled: false, plan: 'starter' },
  reportes_avanzados: { enabled: false, plan: 'business' },
}

const QUOTAS_FALLBACK = {
  free: { usuarios: 2, productos: 50, contactos: 100, oportunidades: 50, facturas_mes: 50 },
  starter: { usuarios: 10, productos: -1, contactos: -1, oportunidades: -1, facturas_mes: -1 },
  business: { usuarios: -1, productos: -1, contactos: -1, oportunidades: -1, facturas_mes: -1 },
}

const PLAN_LABELS = {
  free: { name: 'Free', price: 'Gratis' },
  starter: { name: 'Starter', price: '$29/mes' },
  business: { name: 'Business', price: '$79/mes' },
}

export function featureInfo(featureKey) {
  const f = FEATURES_FALLBACK[featureKey]
  if (!f) return { enabled: true, plan: null }
  return f
}

export function planLabel(plan) {
  return PLAN_LABELS[plan] || { name: plan, price: '' }
}

export function usePlan({ companyId } = {}) {
  const [plan, setPlan] = useState('free')
  const [features, setFeatures] = useState({})
  const [quotas, setQuotas] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) {
      setLoading(false)
      return
    }

    const supabase = getSupabase()

    supabase
      .from('companies')
      .select('plan')
      .eq('id', companyId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setPlan('free')
          setFeatures(FEATURES_FALLBACK)
          setQuotas(QUOTAS_FALLBACK.free)
          setLoading(false)
          return
        }

        const currentPlan = data?.plan || 'free'
        setPlan(currentPlan)

        supabase
          .from('plan_features')
          .select('feature_key, enabled')
          .eq('plan', currentPlan)
          .then(({ data: featData }) => {
            const featMap = {}
            for (const key of Object.keys(FEATURES_FALLBACK)) {
              featMap[key] = {
                enabled: false,
                plan: FEATURES_FALLBACK[key].plan,
              }
            }
            if (featData) {
              for (const f of featData) {
                if (featMap[f.feature_key]) {
                  featMap[f.feature_key].enabled = f.enabled
                }
              }
            }
            setFeatures(featMap)
          })

        supabase
          .from('plan_quotas')
          .select('quota_key, max_value')
          .eq('plan', currentPlan)
          .then(({ data: quotaData }) => {
            const quotaMap = QUOTAS_FALLBACK[currentPlan] || {}
            if (quotaData) {
              for (const q of quotaData) {
                quotaMap[q.quota_key] = q.max_value
              }
            }
            setQuotas(quotaMap)
            setLoading(false)
          })
      })
  }, [companyId])

  const featureEnabled = (key) => {
    return features[key]?.enabled ?? FEATURES_FALLBACK[key]?.enabled ?? true
  }

  const featurePlan = (key) => {
    return features[key]?.plan ?? FEATURES_FALLBACK[key]?.plan ?? null
  }

  const quotaMax = (key) => {
    return quotas[key] ?? -1
  }

  const isUnlimited = (key) => quotaMax(key) === -1

  return {
    plan,
    loading,
    featureEnabled,
    featurePlan,
    quotaMax,
    isUnlimited,
    planInfo: PLAN_LABELS[plan] || PLAN_LABELS.free,
  }
}

export async function checkQuotaBefore(companyId, quotaKey) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('check_quota', {
    p_company_id: companyId,
    p_quota_key: quotaKey,
  })
  if (error) throw new Error(`Error al verificar cupo: ${error.message}`)
  if (!data) throw new Error('No se pudo verificar el cupo disponible')

  if (data.remaining === 0 && data.max !== -1) {
    const nombres = {
      usuarios: 'usuarios',
      productos: 'productos',
      contactos: 'contactos',
      oportunidades: 'oportunidades',
      facturas_mes: 'facturas este mes',
    }
    const nombre = nombres[quotaKey] || quotaKey
    throw new Error(`Alcanzaste el límite de ${nombre} (${data.max}) para tu plan actual. Actualizá tu plan para ampliarlo.`)
  }

  return data
}
