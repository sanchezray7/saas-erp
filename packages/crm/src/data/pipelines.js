import { getSupabase } from '@saas/core'

export async function listarPipelines(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('pipelines')
    .select('*, stages:stages(*)')
    .eq('company_id', companyId)
    .order('name')
  if (error) throw error
  return data
}

export async function guardarPipeline(companyId, pipeline) {
  const supabase = getSupabase()
  const payload = { ...pipeline, company_id: companyId }
  const { data, error } = await supabase
    .from('pipelines')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarPipeline(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('pipelines').delete().eq('id', id)
  if (error) throw error
}

export async function guardarStage(stage) {
  const supabase = getSupabase()
  const payload = { ...stage }
  const { data, error } = await supabase
    .from('stages')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarStage(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('stages').delete().eq('id', id)
  if (error) throw error
}

export async function reordenarStages(pipelineId, stageIds) {
  const supabase = getSupabase()
  const updates = stageIds.map((id, idx) => ({
    id,
    pipeline_id: pipelineId,
    position: idx,
  }))
  const { error } = await supabase.from('stages').upsert(updates)
  if (error) throw error
}
