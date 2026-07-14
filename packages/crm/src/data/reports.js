import { getSupabase } from '@saas/core'

export async function obtenerResumenVentas(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('obtener_resumen_ventas', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data || []
}

export async function obtenerIngresosMensuales(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('obtener_ingresos_mensuales', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data || []
}

export async function obtenerActividadesPorTipo(companyId, desde, hasta) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('obtener_actividades_por_tipo', {
    p_company_id: companyId,
    p_desde: desde,
    p_hasta: hasta,
  })
  if (error) throw error
  return data || []
}

export async function obtenerTopVendedores(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('obtener_top_vendedores', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data || []
}

export async function obtenerConversionEtapas(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('obtener_conversion_etapas', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data || []
}

export async function obtenerVelocidadVentas(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('obtener_velocidad_ventas', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data || {}
}
