import { getSupabase } from '@saas/core'

export async function listarIndustries(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('industries')
    .select('*')
    .eq('company_id', companyId)
    .order('name')
  if (error) throw error
  return data
}

export async function guardarIndustry(companyId, { id, name }) {
  const supabase = getSupabase()
  const payload = { company_id: companyId, name }
  if (id) payload.id = id
  const { data, error } = await supabase
    .from('industries')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarIndustry(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('industries').delete().eq('id', id)
  if (error) throw error
}
