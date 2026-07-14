import { getSupabase } from '@saas/core'

export async function listarProveedores(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('proveedores')
    .select('*, contact:contact_id(name, email, phone)')
    .eq('company_id', companyId)
    .order('nombre')
  if (error) throw error
  return data || []
}

export async function obtenerProveedor(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('proveedores')
    .select('*, contact:contact_id(name, email, phone)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function guardarProveedor(companyId, proveedor) {
  const supabase = getSupabase()
  const payload = { ...proveedor, company_id: companyId }
  if (!payload.id) delete payload.id
  if (!payload.contact_id) payload.contact_id = null
  const { data, error } = await supabase.from('proveedores').upsert(payload).select().single()
  if (error) throw error
  return data
}

export async function eliminarProveedor(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('proveedores').delete().eq('id', id)
  if (error) throw error
}
