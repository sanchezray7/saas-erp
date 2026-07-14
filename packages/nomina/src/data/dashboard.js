import { getSupabase } from '@saas/core'

export async function obtenerResumenNomina(companyId) {
  const supabase = getSupabase()

  const { data: periodos } = await supabase
    .from('nomina_periodos')
    .select('id, nombre, fecha_desde, fecha_hasta')
    .eq('company_id', companyId)
    .eq('estado', 'calculado')
    .order('fecha_desde', { ascending: false })
    .limit(6)

  if (!periodos || periodos.length === 0) return { ultimo: null, evolucion: [], kpis: { empleados: 0, totalRem: 0, totalDed: 0, neto: 0 } }

  const ids = periodos.map((p) => p.id)
  const { data: detalles } = await supabase
    .from('nomina_detalle')
    .select('periodo_id, total_remunerativo, total_deducciones, neto_pagar, empleado_id')
    .in('periodo_id', ids)

  const porPeriodo = {}
  for (const d of detalles || []) {
    if (!porPeriodo[d.periodo_id]) porPeriodo[d.periodo_id] = { empleados: new Set(), rem: 0, ded: 0, neto: 0 }
    porPeriodo[d.periodo_id].empleados.add(d.empleado_id)
    porPeriodo[d.periodo_id].rem += Number(d.total_remunerativo) || 0
    porPeriodo[d.periodo_id].ded += Number(d.total_deducciones) || 0
    porPeriodo[d.periodo_id].neto += Number(d.neto_pagar) || 0
  }

  const ultimoPeriodo = periodos[0]
  const ult = porPeriodo[ultimoPeriodo.id]

  const kpis = {
    empleados: ult?.empleados?.size || 0,
    totalRem: ult?.rem || 0,
    totalDed: ult?.ded || 0,
    neto: ult?.neto || 0,
  }

  const evolucion = periodos.map((p) => {
    const d = porPeriodo[p.id] || { rem: 0, ded: 0, neto: 0 }
    return {
      periodo: p.nombre,
      fecha_desde: p.fecha_desde,
      remunerativo: d.rem,
      deducciones: d.ded,
      neto: d.neto,
    }
  }).reverse()

  return { ultimo: ultimoPeriodo, kpis, evolucion }
}

export async function obtenerNominaPorDepartamento(companyId, periodoId) {
  const supabase = getSupabase()

  const { data: detalles } = await supabase
    .from('nomina_detalle')
    .select('empleado_id, total_remunerativo, total_deducciones, neto_pagar')
    .eq('periodo_id', periodoId)

  if (!detalles || detalles.length === 0) return []

  const empIds = [...new Set(detalles.map((d) => d.empleado_id))]
  const { data: contratos } = await supabase
    .from('empleado_contratos')
    .select('empleado_id, departamento:departamento_id(nombre)')
    .in('empleado_id', empIds)
    .is('vigencia_hasta', null)

  const deptoMap = {}
  for (const c of contratos || []) {
    const depto = c.departamento?.nombre || 'Sin departamento'
    if (!deptoMap[depto]) deptoMap[depto] = { empleados: new Set(), rem: 0, ded: 0, neto: 0 }
  }

  for (const d of detalles || []) {
    const c = (contratos || []).find((c) => c.empleado_id === d.empleado_id)
    const depto = c?.departamento?.nombre || 'Sin departamento'
    if (!deptoMap[depto]) deptoMap[depto] = { empleados: new Set(), rem: 0, ded: 0, neto: 0 }
    deptoMap[depto].empleados.add(d.empleado_id)
    deptoMap[depto].rem += Number(d.total_remunerativo) || 0
    deptoMap[depto].ded += Number(d.total_deducciones) || 0
    deptoMap[depto].neto += Number(d.neto_pagar) || 0
  }

  return Object.entries(deptoMap).map(([nombre, d]) => ({
    nombre,
    empleados: d.empleados.size,
    remunerativo: d.rem,
    deducciones: d.ded,
    neto: d.neto,
  }))
}
