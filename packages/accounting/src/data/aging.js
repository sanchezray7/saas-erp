import { getSupabase } from '@saas/core'

export async function obtenerAgingAP(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('obtener_aging_ap', { p_company_id: companyId })
  if (error) throw error
  return data
}

export async function obtenerAgingAR(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('obtener_aging_ar', { p_company_id: companyId })
  if (error) throw error
  return data
}
