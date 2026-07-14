import { getSupabase } from '@saas/core'

const WON_STAGE_NAME = 'Cerrado ganado'

export async function obtenerAgenda(companyId, userId) {
  const supabase = getSupabase()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  const [actividadesRes, eventosRes, dealsRes, stagesRes] = await Promise.all([
    supabase
      .from('activities')
      .select('*, contact:contact_id(name), deal:deal_id(title)')
      .eq('company_id', companyId)
      .eq('assigned_to', userId)
      .eq('done', false)
      .gte('due_date', todayStart.toISOString())
      .lte('due_date', todayEnd.toISOString())
      .order('due_date'),
    supabase
      .from('eventos')
      .select('*')
      .eq('company_id', companyId)
      .eq('assigned_to', userId)
      .gte('start_date', todayStart.toISOString())
      .lte('start_date', todayEnd.toISOString())
      .order('start_date'),
    supabase
      .from('deals')
      .select('id,title,value,expected_close_date,contact:contact_id(name)')
      .eq('company_id', companyId)
      .not('expected_close_date', 'is', null)
      .lte('expected_close_date', sevenDaysFromNow.toISOString())
      .order('expected_close_date'),
    supabase
      .from('stages')
      .select('id')
      .eq('name', WON_STAGE_NAME),
  ])

  const wonStageIds = new Set((stagesRes.data || []).map((s) => s.id))
  const actividades = actividadesRes.data || []
  const eventos = eventosRes.data || []
  const deals = (dealsRes.data || []).filter((d) => !wonStageIds.has(d.stage_id))

  const resumen = {
    llamadas: actividades.filter((a) => a.type === 'call').length,
    reuniones: actividades.filter((a) => a.type === 'meeting').length,
    tareas: actividades.filter((a) => a.type === 'task').length,
    propuestas: deals.length,
  }

  return { resumen, actividades, eventos, expiring: deals }
}
