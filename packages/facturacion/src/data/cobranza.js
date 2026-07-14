import { getSupabase } from '@saas/core'

export async function obtenerConfigCobranza(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('cobranza_config')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()
  if (error) throw error
  return data || null
}

export async function guardarConfigCobranza(companyId, config) {
  const supabase = getSupabase()
  const payload = { company_id: companyId, ...config }
  const { error } = await supabase
    .from('cobranza_config')
    .upsert(payload)
  if (error) throw error
}

export async function obtenerFacturasPendientes(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('facturas')
    .select('*, contact:contact_id(name, phone)')
    .eq('company_id', companyId)
    .eq('estado', 'aprobada')
    .not('contact_id', 'is', null)
    .order('fecha_vencimiento', { ascending: true })
  if (error) throw error
  return data || []
}
