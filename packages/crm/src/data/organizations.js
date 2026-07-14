import { getSupabase } from '@saas/core'

export async function listarOrganizaciones(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('company_id', companyId)
    .order('name')
  if (error) throw error
  return data
}

export async function obtenerOrganizacion(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function guardarOrganizacion(companyId, org) {
  const supabase = getSupabase()
  const payload = { ...org, company_id: companyId }
  if (!payload.id) delete payload.id
  const { data, error } = await supabase
    .from('organizations')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarOrganizacion(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('organizations').delete().eq('id', id)
  if (error) throw error
}

export async function importarOrganizaciones(companyId, rows) {
  const supabase = getSupabase()
  const payload = rows.map((r) => ({ ...r, company_id: companyId }))
  const { error } = await supabase.from('organizations').upsert(payload)
  if (error) throw error
}
