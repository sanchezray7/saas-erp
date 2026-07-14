import { getSupabase } from '@saas/core'

export async function calcularControl(companyId, desde, hasta, empleadoId = null) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('calcular_control_horario', {
    p_company_id: companyId, p_desde: desde, p_hasta: hasta,
    p_empleado_id: empleadoId || null,
  })
  if (error) throw error
  return data
}

export async function listarControlResumen(companyId, desde, hasta, empleadoId = null) {
  const supabase = getSupabase()
  if (!desde || !hasta) return []
  let query = supabase
    .from('control_horario')
    .select('*, empleado:empleado_id(nombre, apellido)')
    .eq('company_id', companyId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
  if (empleadoId) query = query.eq('empleado_id', empleadoId)
  const { data, error } = await query.order('fecha')
  if (error) throw error

  // Agrupar por empleado
  const grupos = {}
  for (const r of data || []) {
    const key = r.empleado_id
    if (!grupos[key]) {
      grupos[key] = {
        empleado_id: r.empleado_id,
        nombre: `${r.empleado?.apellido || ''}, ${r.empleado?.nombre || ''}`,
        dias: 0, ausencias: 0,
        total_hs: 0, total_atraso: 0, total_extra: 0, total_nocturno: 0, total_salida_temp: 0,
        detalle: [],
      }
    }
    const g = grupos[key]
    g.dias++
    if (r.es_ausente) g.ausencias++
    if (!r.turno_planificado && !r.entrada_real) g.descansos = (g.descansos || 0) + 1
    if (r.turno_planificado && !r.entrada_real && !r.es_ausente) g.sin_marcar = (g.sin_marcar || 0) + 1
    g.total_hs += r.minutos_trabajados
    g.total_atraso += r.minutos_atraso
    g.total_extra += r.minutos_extra
    g.total_extra_50 = (g.total_extra_50 || 0) + (r.minutos_extra_50 || 0)
    g.total_extra_100 = (g.total_extra_100 || 0) + (r.minutos_extra_100 || 0)
    g.total_extra_130 = (g.total_extra_130 || 0) + (r.minutos_extra_130 || 0)
    g.total_nocturno += r.minutos_nocturnos
    g.total_salida_temp += r.minutos_salida_temp
    g.detalle.push(r)
  }

  return Object.values(grupos).sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export async function obtenerDetalleEmpleado(empleadoId, desde, hasta) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('control_horario')
    .select('*')
    .eq('empleado_id', empleadoId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha')
  if (error) throw error
  return data || []
}
