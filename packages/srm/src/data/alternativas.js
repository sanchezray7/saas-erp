import { getSupabase } from '@saas/core'

export async function productosConAlternativas(proveedorId, companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('productos_con_alternativas', {
    p_proveedor_id: proveedorId,
    p_company_id: companyId,
  })
  if (error) throw error
  return data || []
}
