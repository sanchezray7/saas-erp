import { getSupabase } from '@saas/core'

export async function productosConHistorial(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('productos_con_historial', { p_company_id: companyId })
  if (error) throw error
  return data || []
}

export async function historialPreciosProducto(companyId, productoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('historial_precios_producto', { p_company_id: companyId, p_producto_id: productoId })
  if (error) throw error
  return data || []
}
