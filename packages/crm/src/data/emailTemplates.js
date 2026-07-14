import { getSupabase } from '@saas/core'

export async function listarTemplates(companyId, context) {
  const supabase = getSupabase()
  let query = supabase
    .from('email_templates')
    .select('*')
    .eq('company_id', companyId)
    .order('name')
  if (context) {
    query = query.eq('context', context)
  }
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function guardarTemplate(companyId, template) {
  const supabase = getSupabase()
  const payload = { ...template, company_id: companyId }
  if (!payload.id) delete payload.id
  const { data, error } = await supabase
    .from('email_templates')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarTemplate(id) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', id)
  if (error) throw error
}
