import { getSupabase } from '@saas/core'

export async function listarTags(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('company_id', companyId)
    .order('nombre')
  if (error) throw error
  return data || []
}

export async function crearTag(companyId, nombre, color) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('tags')
    .insert({ company_id: companyId, nombre: nombre.trim(), color: color || '#6366f1' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function obtenerTagPorNombre(companyId, nombre) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('company_id', companyId)
    .eq('nombre', nombre)
    .maybeSingle()
  if (error) throw error
  return data
}

// Contact tags
export async function listarTagsDeContacto(contactId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('contact_tags')
    .select('tag:tag_id(*)')
    .eq('contact_id', contactId)
  if (error) throw error
  return (data || []).map((r) => r.tag)
}

export async function asignarTagAContacto(contactId, tagId) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('contact_tags')
    .insert({ contact_id: contactId, tag_id: tagId })
  if (error && !error.message?.includes('violates unique constraint')) throw error
}

export async function quitarTagDeContacto(contactId, tagId) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('contact_tags')
    .delete()
    .eq('contact_id', contactId)
    .eq('tag_id', tagId)
  if (error) throw error
}
