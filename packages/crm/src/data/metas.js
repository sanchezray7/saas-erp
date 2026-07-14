import { getSupabase } from '@saas/core'

export async function listarMetas(companyId, anio, mes) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('metas_ventas')
    .select('*')
    .eq('company_id', companyId)
    .eq('anio', anio)
    .eq('mes', mes)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function guardarMeta(companyId, userId, anio, mes, monto) {
  const supabase = getSupabase()
  const payload = { company_id: companyId, user_id: userId, anio, mes, monto_objetivo: monto }
  const { error } = await supabase
    .from('metas_ventas')
    .upsert(payload, { onConflict: 'company_id,user_id,anio,mes' })
  if (error) throw error
}

export async function eliminarMeta(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('metas_ventas').delete().eq('id', id)
  if (error) throw error
}

export async function obtenerProgreso(companyId, anio, mes) {
  const supabase = getSupabase()
  try {
    // Consultar metas del período
    const { data: metas, error: metaError } = await supabase
      .from('metas_ventas')
      .select('*')
      .eq('company_id', companyId)
      .eq('anio', anio)
      .eq('mes', mes)

    if (metaError) return []
    if (!metas || metas.length === 0) return []

    // Obtener nombres de usuarios
    const userIds = metas.map((m) => m.user_id)
    let userMap = {}
    try {
      const { data: miembros } = await supabase.rpc('listar_miembros_empresa', {
        p_company_id: companyId,
      })
      for (const m of miembros || []) {
        userMap[m.user_id] = m.nombre || m.email || m.user_id.slice(0, 8)
      }
    } catch {
      // Si no puede obtener nombres, usar UUID corto
      for (const id of userIds) {
        userMap[id] = id.slice(0, 8)
      }
    }

    // Consultar deals ganados en el período
    const { data: stages } = await supabase
      .from('stages')
      .select('id')
      .eq('name', 'Cerrado ganado')

    const stageIds = (stages || []).map((s) => s.id)
    if (stageIds.length === 0) return []

    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('value, contact:contact_id(assigned_to)')
      .eq('company_id', companyId)
      .in('stage_id', stageIds)

    if (dealsError) return []

    // Calcular por usuario (assigned_to viene del contacto)
    const porUsuario = {}
    for (const d of deals || []) {
      const uid = d.contact?.assigned_to
      if (!uid) continue
      if (!porUsuario[uid]) porUsuario[uid] = { monto: 0, count: 0 }
      porUsuario[uid].monto += Number(d.value || 0)
      porUsuario[uid].count++
    }

    return metas.map((m) => {
      const alcanzado = porUsuario[m.user_id]?.monto || 0
      const objetivo = Number(m.monto_objetivo) || 0
      return {
        user_id: m.user_id,
        email: userMap[m.user_id] || m.user_id.slice(0, 8),
        nombre: userMap[m.user_id] || '',
        monto_objetivo: objetivo,
        monto_alcanzado: alcanzado,
        porcentaje: objetivo > 0 ? Math.round((alcanzado / objetivo) * 100) : 0,
        deals_ganados: porUsuario[m.user_id]?.count || 0,
      }
    })
  } catch {
    return []
  }
}
