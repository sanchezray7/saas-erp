import { getSupabase } from '@saas/core'

// === Consolidación básica ===

export async function obtenerConsolidacionBalance(companyId, eliminarIC = false) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('consolidar_balance_con_ajustes', {
    p_company_id: companyId, p_eliminar_ic: eliminarIC,
  })
  if (error) throw error
  return data
}

export async function obtenerConsolidacionResultados(companyId, eliminarIC = false) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('consolidar_resultados_con_ajustes', {
    p_company_id: companyId, p_eliminar_ic: eliminarIC,
  })
  if (error) throw error
  return data
}

export async function obtenerConsolidacionAgingAP(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('consolidar_aging_ap', { p_company_id: companyId })
  if (error) throw error
  return data
}

export async function obtenerConsolidacionAgingAR(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('consolidar_aging_ar', { p_company_id: companyId })
  if (error) throw error
  return data
}

export async function obtenerResumenPorSucursal(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('resumen_por_sucursal', { p_company_id: companyId })
  if (error) throw error
  return data || []
}

// === Asientos de consolidación ===

export async function listarAsientosConsolidacion(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('consolidacion_asientos')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function obtenerAsientoConsolidacion(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('consolidacion_asientos')
    .select('*, lines:consolidacion_asiento_lines(*, account:account_id(code, name))')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function guardarAsientoConsolidacion(companyId, userId, payload) {
  const supabase = getSupabase()
  const lines = payload.lines || []
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0)

  const entry = {
    company_id: companyId,
    entry_number: payload.entry_number || 'CA-' + Date.now().toString(36).toUpperCase(),
    description: payload.description,
    entry_date: payload.entry_date || new Date().toISOString().slice(0, 10),
    total_debit: totalDebit,
    total_credit: totalCredit,
    estado: payload.estado || 'borrador',
    created_by: userId,
  }

  if (payload.id) {
    const { error } = await supabase.from('consolidacion_asientos').update(entry).eq('id', payload.id)
    if (error) throw error
    await supabase.from('consolidacion_asiento_lines').delete().eq('asiento_id', payload.id)
  } else {
    const { data, error } = await supabase.from('consolidacion_asientos').insert(entry).select('id').single()
    if (error) throw error
    payload.id = data.id
  }

  if (lines.length > 0) {
    const { error } = await supabase.from('consolidacion_asiento_lines').insert(
      lines.map((l) => ({
        asiento_id: payload.id,
        account_id: l.account_id,
        description: l.description || null,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      }))
    )
    if (error) throw error
  }

  return payload.id
}

export async function anularAsientoConsolidacion(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('consolidacion_asientos').update({ estado: 'anulado' }).eq('id', id)
  if (error) throw error
}

export async function contabilizarAsientoConsolidacion(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('consolidacion_asientos').update({ estado: 'contabilizado' }).eq('id', id)
  if (error) throw error
}

export async function eliminarAsientoConsolidacion(id) {
  const supabase = getSupabase()
  await supabase.from('consolidacion_asiento_lines').delete().eq('asiento_id', id)
  await supabase.from('consolidacion_asientos').delete().eq('id', id)
}

// === Holding / Grupos económicos ===

export async function listarGruposHolding(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('grupos_holding').select('*').eq('company_id', companyId).order('nombre')
  if (error) throw error
  return data || []
}

export async function guardarGrupoHolding(companyId, { id, nombre }) {
  const supabase = getSupabase()
  if (id) {
    const { error } = await supabase.from('grupos_holding').update({ nombre }).eq('id', id)
    if (error) throw error
    return id
  }
  const { data, error } = await supabase.from('grupos_holding').insert({ company_id: companyId, nombre }).select('id').single()
  if (error) throw error
  return data.id
}

export async function eliminarGrupoHolding(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('grupos_holding').delete().eq('id', id)
  if (error) throw error
}

export async function listarMiembrosHolding(grupoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('holding_miembros')
    .select('*, company:company_id(id, name)')
    .eq('grupo_id', grupoId)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function agregarMiembroHolding(grupoId, companyId, participacion = 100) {
  const supabase = getSupabase()
  const { error } = await supabase.from('holding_miembros').insert({
    grupo_id: grupoId, company_id: companyId, participacion,
  })
  if (error) throw error
}

export async function eliminarMiembroHolding(grupoId, companyId) {
  const supabase = getSupabase()
  const { error } = await supabase.from('holding_miembros').delete().match({ grupo_id: grupoId, company_id: companyId })
  if (error) throw error
}

// === Consolidación por holding ===

export async function obtenerBalanceHolding(grupoId, eliminarIC = false) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('consolidar_balance_holding', {
    p_grupo_id: grupoId, p_eliminar_ic: eliminarIC,
  })
  if (error) throw error
  return data
}

export async function obtenerResultadosHolding(grupoId, eliminarIC = false) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('consolidar_resultados_holding', {
    p_grupo_id: grupoId, p_eliminar_ic: eliminarIC,
  })
  if (error) throw error
  return data
}

export async function obtenerResumenPorHolding(grupoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('resumen_por_holding', { p_grupo_id: grupoId })
  if (error) throw error
  return data || []
}
