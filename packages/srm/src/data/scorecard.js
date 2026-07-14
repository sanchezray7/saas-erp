import { getSupabase } from '@saas/core'

export async function calcularScorecards(companyId) {
  const supabase = getSupabase()
  const { error } = await supabase.rpc('calcular_scorecards', { p_company_id: companyId })
  if (error) throw error
}

export async function obtenerScorecards(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('obtener_scorecards', { p_company_id: companyId })
  if (error) throw error
  return data || []
}

export async function guardarScorecardManual(id, calidad, comunicacion, notas) {
  const supabase = getSupabase()
  const { error } = await supabase.rpc('guardar_scorecard_manual', {
    p_id: id,
    p_calidad: Number(calidad),
    p_comunicacion: Number(comunicacion),
    p_notas: notas || '',
  })
  if (error) throw error
}

export async function obtenerScorecardDeProveedor(proveedorId, companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('proveedor_scorecard')
    .select('*')
    .eq('company_id', companyId)
    .eq('proveedor_id', proveedorId)
    .maybeSingle()
  if (error) throw error
  return data
}
