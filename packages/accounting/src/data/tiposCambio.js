import { getSupabase } from '@saas/core'

export async function listarTiposCambio(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('tipos_cambio').select('*').eq('company_id', companyId).order('fecha', { ascending: false })
  if (error) throw error
  return data || []
}

export async function guardarTipoCambio(companyId, { moneda_origen, moneda_destino = 'PYG', tasa, fecha }) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('tipos_cambio').insert({
    company_id: companyId, moneda_origen, moneda_destino, tasa, fecha,
  }).select('id').single()
  if (error) throw error
  return data.id
}

export async function eliminarTipoCambio(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('tipos_cambio').delete().eq('id', id)
  if (error) throw error
}
