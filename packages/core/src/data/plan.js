import { useState, useEffect } from 'react'
import { getSupabase } from '../lib/supabase'
import { FEATURES, QUOTAS, QUOTA_LABELS, PLAN_LABELS } from './planConfig'

export { FEATURES, QUOTAS, PLAN_LABELS } from './planConfig'

export function featureInfo(featureKey) {
  const f = FEATURES[featureKey]
  if (!f) return { enabled: true, plan: null }

  // Para UpgradeBanner: determinar el plan mínimo que habilita la feature
  if (f.free) return { enabled: true, plan: null }
  if (f.starter) return { enabled: false, plan: 'starter' }
  return { enabled: false, plan: 'business' }
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
          buildFeatureMap('free')
          setQuotas(QUOTAS.free || {})
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
            buildFeatureMap(currentPlan, featData)
          })

        supabase
          .from('plan_quotas')
          .select('quota_key, max_value')
          .eq('plan', currentPlan)
          .then(({ data: quotaData }) => {
            const quotaMap = { ...(QUOTAS[currentPlan] || {}) }
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

  function buildFeatureMap(currentPlan, dbData) {
    const featMap = {}
    for (const key of Object.keys(FEATURES)) {
      const enabled = FEATURES[key][currentPlan] === true
      featMap[key] = { enabled, plan: minPlanForFeature(key) }
    }
    if (dbData) {
      for (const f of dbData) {
        if (featMap[f.feature_key]) {
          featMap[f.feature_key].enabled = f.enabled
        }
      }
    }
    setFeatures(featMap)
  }

  function minPlanForFeature(key) {
    const f = FEATURES[key]
    if (!f) return null
    if (f.free) return null
    if (f.starter) return 'starter'
    return 'business'
  }

  const featureEnabled = (key) => {
    return features[key]?.enabled ?? false
  }

  const featurePlan = (key) => {
    return features[key]?.plan ?? minPlanForFeature(key)
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
    const nombre = QUOTA_LABELS[quotaKey] || quotaKey
    throw new Error(`Alcanzaste el límite de ${nombre} (${data.max}) para tu plan actual. Actualizá tu plan para ampliarlo.`)
  }

  return data
}
