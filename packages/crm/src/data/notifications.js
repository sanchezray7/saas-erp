import { getSupabase } from '@saas/core'

export async function listarNotificaciones(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('listar_notificaciones', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data || []
}

export async function contarNoLeidas(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('contar_no_leidas', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data || 0
}

export async function marcarLeida(id) {
  const supabase = getSupabase()
  const { error } = await supabase.rpc('marcar_leida', { p_id: id })
  if (error) throw error
}

export async function crearNotificacion(companyId, userId, type, title, message, link) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('crear_notificacion', {
    p_company_id: companyId,
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_message: message,
    p_link: link || null,
  })
  if (error) throw error
  return data
}

export async function crearNotificacionTodos(companyId, type, title, message, link) {
  const supabase = getSupabase()
  const { error } = await supabase.rpc('crear_notificacion_todos', {
    p_company_id: companyId,
    p_type: type,
    p_title: title,
    p_message: message,
    p_link: link || null,
  })
  if (error) throw error
}

export async function marcarTodasLeidas(companyId) {
  const supabase = getSupabase()
  const { error } = await supabase.rpc('marcar_todas_leidas', {
    p_company_id: companyId,
  })
  if (error) throw error
}
