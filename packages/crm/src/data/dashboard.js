import { getSupabase } from '@saas/core'

const WON_STAGE_NAME = 'Cerrado ganado'

export async function obtenerDashboard(companyId) {
  const supabase = getSupabase()

  const [dealsRes, contactsRes, pipelinesRes] = await Promise.all([
    supabase.from('deals').select('id,value,stage_id,expected_close_date,created_at').eq('company_id', companyId),
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('pipelines').select('id').eq('company_id', companyId),
  ])

  const pipelineIds = (pipelinesRes.data || []).map((p) => p.id)
  const stageMap = {}
  const stageByName = {}
  let wonStageIds = new Set()

  if (pipelineIds.length > 0) {
    const { data: stages } = await supabase
      .from('stages')
      .select('id,name,probability,color')
      .in('pipeline_id', pipelineIds)

    for (const s of stages || []) {
      stageMap[s.id] = s
      stageByName[s.name] = s
      if (s.name === WON_STAGE_NAME) wonStageIds.add(s.id)
    }
  }

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const deals = dealsRes.data || []
  let openDeals = 0
  let wonDealsThisMonth = 0
  let wonDealsLastMonth = 0
  let totalValue = 0
  let weightedForecast = 0
  const stageBuckets = {}
  const projection = []

  for (const d of deals) {
    const val = parseFloat(d.value) || 0
    totalValue += val

    if (d.stage_id && wonStageIds.has(d.stage_id)) {
      if (d.closed_at) {
        const closed = new Date(d.closed_at)
        if (closed >= thisMonthStart) wonDealsThisMonth++
        if (closed >= lastMonthStart && closed < thisMonthStart) wonDealsLastMonth++
      } else {
        wonDealsThisMonth++
      }
    } else if (d.stage_id) {
      openDeals++
      const prob = stageMap[d.stage_id]?.probability || 0
      weightedForecast += val * prob / 100

      // Agrupar por etapa para el funnel
      const stage = stageMap[d.stage_id]
      if (stage) {
        if (!stageBuckets[stage.id]) {
          stageBuckets[stage.id] = { ...stage, count: 0, value: 0 }
        }
        stageBuckets[stage.id].count++
        stageBuckets[stage.id].value += val
      }
    }
  }

  // Proyección próximos 3 meses
  const threeMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 3, 1)
  for (let i = 0; i < 3; i++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0, 23, 59, 59)
    let monthValue = 0
    for (const d of deals) {
      if (!d.expected_close_date || wonStageIds.has(d.stage_id)) continue
      const closeDate = new Date(d.expected_close_date)
      if (closeDate >= monthStart && closeDate <= monthEnd) {
        monthValue += parseFloat(d.value) || 0
      }
    }
    projection.push({
      month: monthStart.toLocaleDateString('es', { month: 'short' }),
      value: Number(monthValue.toFixed(2)),
    })
  }

  const change = wonDealsLastMonth > 0
    ? ((wonDealsThisMonth - wonDealsLastMonth) / wonDealsLastMonth * 100)
    : wonDealsThisMonth > 0 ? 100 : 0

  const funnel = Object.values(stageBuckets)
    .map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color || '#2c7be5',
      probability: s.probability || 0,
      count: s.count,
      value: Number(s.value.toFixed(2)),
    }))
    .sort((a, b) => b.count - a.count)

  return {
    kpis: {
      openDeals,
      wonDeals: wonDealsThisMonth,
      totalValue: Number(totalValue.toFixed(2)),
      weightedForecast: Number(weightedForecast.toFixed(2)),
      contacts: contactsRes.count || 0,
    },
    funnel,
    monthly: {
      currentMonth: wonDealsThisMonth,
      previousMonth: wonDealsLastMonth,
      change: Number(change.toFixed(1)),
    },
    projection,
  }
}
