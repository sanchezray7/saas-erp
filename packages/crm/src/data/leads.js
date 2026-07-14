import { getSupabase } from '@saas/core'

export async function obtenerWebhookToken(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('obtener_token_webhook', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data || {}
}

export async function regenerarTokenWebhook(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('regenerar_token_webhook', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data
}

export async function toggleWebhookActivo(companyId, isActive) {
  const supabase = getSupabase()
  const { error } = await supabase.rpc('toggle_webhook_activo', {
    p_company_id: companyId,
    p_active: isActive,
  })
  if (error) throw error
}

export async function listarLeads(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('contacts')
    .select('id, name, email, phone, notes, source, assigned_to, created_at')
    .eq('company_id', companyId)
    .eq('source', 'webhook')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function asignarLead(leadId, userId) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('contacts')
    .update({ assigned_to: userId })
    .eq('id', leadId)
  if (error) throw error
}

export async function convertirLead(leadId) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('contacts')
    .update({ source: null })
    .eq('id', leadId)
  if (error) throw error
}

export async function obtenerEmpresaPorToken(token) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('obtener_empresa_por_token', {
    p_token: token,
  })
  if (error) throw error
  return data || {}
}
