import { getSupabase } from '@saas/core'

export async function listarActividades(companyId, filters = {}) {
  let query = getSupabase()
    .from('activities')
    .select('*, contact:contact_id(name), deal:deal_id(title)')
    .eq('company_id', companyId)
    .order('due_date', { ascending: false, nullsFirst: false })

  if (filters.type) query = query.eq('type', filters.type)
  if (filters.done !== undefined) query = query.eq('done', filters.done)
  if (filters.contactId) query = query.eq('contact_id', filters.contactId)
  if (filters.dealId) query = query.eq('deal_id', filters.dealId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function guardarActividad(companyId, activity) {
  const supabase = getSupabase()
  const payload = { ...activity, company_id: companyId }
  const { data, error } = await supabase
    .from('activities')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarActividad(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('activities').delete().eq('id', id)
  if (error) throw error
}

export async function toggleActividad(id, done) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('activities')
    .update({ done })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
