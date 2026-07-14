import { getSupabase } from '@saas/core'

export async function listarCierres(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('cierres_contables').select('*').eq('company_id', companyId).order('periodo', { ascending: false })
  if (error) throw error
  return data || []
}

export async function cerrarPeriodo(companyId, periodo, userId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('cierres_contables').upsert({
    company_id: companyId, periodo, estado: 'cerrado',
    cerrado_por: userId, cerrado_en: new Date().toISOString(),
  }, { onConflict: 'company_id,periodo' }).select('id').single()
  if (error) throw error
  return data.id
}

export async function reabrirPeriodo(companyId, periodo) {
  const supabase = getSupabase()
  const { error } = await supabase.from('cierres_contables').upsert({
    company_id: companyId, periodo, estado: 'reabierto',
  }, { onConflict: 'company_id,periodo' })
  if (error) throw error
}
