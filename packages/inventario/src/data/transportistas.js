import { getSupabase } from '@saas/core'

export async function listarTransportistas(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('transportistas').select('*').eq('company_id', companyId).eq('activo', true).order('nombre')
  if (error) throw error
  return data || []
}

export async function guardarTransportista(companyId, t) {
  const supabase = getSupabase()
  const payload = { company_id: companyId, nombre: t.nombre, ruc: t.ruc || null, telefono: t.telefono || null, contacto: t.contacto || null }
  if (t.id) { const { error } = await supabase.from('transportistas').update(payload).eq('id', t.id); if (error) throw error; return t.id }
  const { data, error } = await supabase.from('transportistas').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}

export async function eliminarTransportista(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('transportistas').delete().eq('id', id)
  if (error) throw error
}
