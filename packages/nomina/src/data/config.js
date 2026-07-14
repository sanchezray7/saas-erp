import { getSupabase } from '@saas/core'

export async function obtenerConfig(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('nomina_config').select('*').eq('company_id', companyId).maybeSingle()
  if (error) throw error
  return data || { frecuencia: 'mensual', dia_cierre: 0, dia_pago: 5, numero_patronal: '' }
}

export async function guardarConfig(companyId, payload) {
  const supabase = getSupabase()
  const { error } = await supabase.from('nomina_config').upsert({
    company_id: companyId,
    frecuencia: payload.frecuencia || 'mensual',
    dia_cierre: Number(payload.dia_cierre) || 0,
    dia_pago: Number(payload.dia_pago) || 5,
    numero_patronal: payload.numero_patronal || '',
  })
  if (error) throw error
}
