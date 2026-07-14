import { getSupabase } from '@saas/core'

export async function listarEventos(companyId, startDate, endDate) {
  const supabase = getSupabase()
  let query = supabase
    .from('eventos')
    .select('*')
    .eq('company_id', companyId)
    .order('start_date', { ascending: true })

  if (startDate) {
    query = query.gte('start_date', startDate.toISOString())
  }
  if (endDate) {
    query = query.lte('start_date', endDate.toISOString())
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function guardarEvento(companyId, evento) {
  const supabase = getSupabase()
  const payload = { ...evento, company_id: companyId }
  const { data, error } = await supabase
    .from('eventos')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarEvento(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('eventos').delete().eq('id', id)
  if (error) throw error
}
