import { getSupabase } from '@saas/core'

export async function listarRouting(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('listar_routing', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data || []
}

export async function guardarRouting(companyId, { id, user_id, orden, activo }) {
  const supabase = getSupabase()
  const payload = { company_id: companyId, user_id, orden, activo }
  if (id) payload.id = id
  const { data, error } = await supabase
    .from('lead_routing')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarRouting(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('lead_routing').delete().eq('id', id)
  if (error) throw error
}

export async function listarMiembros(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('listar_miembros_empresa', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data || []
}

export async function eliminarMiembro(companyId, userId) {
  const supabase = getSupabase()
  const { error } = await supabase.rpc('eliminar_miembro', {
    p_company_id: companyId,
    p_user_id: userId,
  })
  if (error) throw error
}
