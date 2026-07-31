import { getSupabase } from '../lib/supabase'

// Obtiene la conversación activa del usuario+empresa (o la crea)
export async function getOrCreateConversacion(companyId, userId) {
  const supabase = getSupabase()

  const { data: existing } = await supabase
    .from('chat_conversaciones')
    .select('id, titulo')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (existing && existing.length > 0) return { id: existing[0].id, titulo: existing[0].titulo }

  const { data: created, error } = await supabase
    .from('chat_conversaciones')
    .insert({ company_id: companyId, user_id: userId })
    .select('id, titulo')
    .single()

  if (error) throw error
  return { id: created.id, titulo: created.titulo }
}

export async function listarMensajes(conversacionId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('chat_mensajes')
    .select('id, role, content')
    .eq('conversacion_id', conversacionId)
    .order('created_at', { ascending: true })
    .limit(100)
  if (error) throw error
  return (data || []).map((m) => ({ role: m.role, content: m.content }))
}

export async function guardarMensaje(conversacionId, role, content) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('chat_mensajes')
    .insert({ conversacion_id: conversacionId, role, content })
  if (error) throw error
}

export async function actualizarTituloConversacion(conversacionId, titulo) {
  const supabase = getSupabase()
  await supabase
    .from('chat_conversaciones')
    .update({ titulo, updated_at: new Date().toISOString() })
    .eq('id', conversacionId)
}

export async function borrarConversaciones(companyId, userId) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('chat_conversaciones')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', userId)
  if (error) throw error
}
