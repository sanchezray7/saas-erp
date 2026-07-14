import { getSupabase } from '@saas/core'

export async function obtenerCalendarioPagos(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('obtener_calendario_pagos', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data || { resumen: { vencidas: 0, dias7: 0, dias15: 0, dias30: 0 }, ordenes: [] }
}
