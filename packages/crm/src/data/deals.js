import { getSupabase, checkQuotaBefore } from '@saas/core'

export async function listarDeals(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('deals')
    .select('*, stage:stage_id(name,color), contact:contact_id(name), organization:organization_id(name)')
    .eq('company_id', companyId)
    .order('position')
  if (error) throw error
  return data
}

export async function obtenerDeal(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('deals')
    .select('*, stage:stage_id(name,color), contact:contact_id(name), organization:organization_id(name)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function guardarDeal(companyId, deal) {
  const supabase = getSupabase()

  // Solo validar cuota en creación
  if (!deal.id) {
    await checkQuotaBefore(companyId, 'oportunidades')
  }

  const payload = { ...deal, company_id: companyId }
  if (payload.stage_id) {
    const esGanada = await _esEtapaGanada(payload.stage_id)
    if (esGanada && !payload.closed_at) payload.closed_at = new Date().toISOString()
  }
  const { data, error } = await supabase
    .from('deals')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarDeal(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('deals').delete().eq('id', id)
  if (error) throw error
}

export async function importarDeals(companyId, rows) {
  const supabase = getSupabase()
  const payload = rows.map((r) => ({ ...r, company_id: companyId }))
  const { error } = await supabase.from('deals').upsert(payload)
  if (error) throw error
}

const WON_STAGE_NAME = 'Cerrado ganado'

async function _esEtapaGanada(stageId) {
  const supabase = getSupabase()
  const { data } = await supabase.from('stages').select('name').eq('id', stageId).single()
  return data?.name === WON_STAGE_NAME
}

export async function moverDeal(id, stageId, position) {
  const supabase = getSupabase()
  const esGanada = await _esEtapaGanada(stageId)
  const update = { stage_id: stageId, position }
  if (esGanada) update.closed_at = new Date().toISOString()
  const { data, error } = await supabase
    .from('deals')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
