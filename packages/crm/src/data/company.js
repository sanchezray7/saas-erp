import { getSupabase } from '@saas/core'

export async function obtenerPerfilEmpresa(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single()
  if (error) throw error
  return data
}

export async function actualizarPerfilEmpresa(companyId, data) {
  const supabase = getSupabase()
  const { data: result, error } = await supabase.rpc('actualizar_empresa', {
    p_company_id: companyId,
    p_data: data,
  })
  if (error) throw error
  if (result?.error) throw new Error(result.error)
}
