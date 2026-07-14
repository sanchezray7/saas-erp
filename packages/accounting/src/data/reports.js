import { getSupabase } from '@saas/core'

export async function reporteBalance(companyId, fechaCorte) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('reporte_balance', { p_company_id: companyId, p_fecha_corte: fechaCorte })
  if (error) throw error
  return data
}

export async function reporteResultados(companyId, desde, hasta) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('reporte_resultados', { p_company_id: companyId, p_desde: desde, p_hasta: hasta })
  if (error) throw error
  return data
}

export async function reporteIva(companyId, desde, hasta) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('reporte_iva', { p_company_id: companyId, p_desde: desde, p_hasta: hasta })
  if (error) throw error
  return data
}

export async function reporteMayorContable(companyId, accountId, desde, hasta, sourceType = null) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('reporte_mayor_contable', {
    p_company_id: companyId, p_account_id: accountId, p_desde: desde, p_hasta: hasta, p_source_type: sourceType,
  })
  if (error) throw error
  return data
}

// Versiones consolidadas (multi-sucursal)
export async function reporteBalanceConsolidado(companyId, fechaCorte) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('reporte_balance_consolidado', { p_company_id: companyId, p_fecha_corte: fechaCorte })
  if (error) throw error
  return data
}

export async function reporteResultadosConsolidado(companyId, desde, hasta) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('reporte_resultados_consolidado', { p_company_id: companyId, p_desde: desde, p_hasta: hasta })
  if (error) throw error
  return data
}

export async function reporteIvaConsolidado(companyId, desde, hasta) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('reporte_iva_consolidado', { p_company_id: companyId, p_desde: desde, p_hasta: hasta })
  if (error) throw error
  return data
}

export async function reporteMayorConsolidado(companyId, accountId, desde, hasta, sourceType = null) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('reporte_mayor_consolidado', {
    p_company_id: companyId, p_account_id: accountId, p_desde: desde, p_hasta: hasta, p_source_type: sourceType,
  })
  if (error) throw error
  return data
}

export async function reporteFlujoEfectivo(companyId, desde, hasta) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('reporte_flujo_efectivo', {
    p_company_id: companyId, p_desde: desde, p_hasta: hasta,
  })
  if (error) throw error
  return data
}
