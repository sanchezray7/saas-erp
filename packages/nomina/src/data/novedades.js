import { getSupabase } from '@saas/core'

export async function listarNovedades(periodoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('nomina_novedades')
    .select('*, concepto:concepto_id(codigo, nombre, tipo), empleado:empleado_id(nombre, apellido)')
    .eq('periodo_id', periodoId)
    .order('created_at')
  if (error) throw error; return data || []
}

export async function listarNovedadesEmpleado(periodoId, empleadoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('nomina_novedades')
    .select('*, concepto:concepto_id(codigo, nombre, tipo)')
    .match({ periodo_id: periodoId, empleado_id: empleadoId })
    .order('created_at')
  if (error) throw error; return data || []
}

export async function guardarNovedad(companyId, payload) {
  const supabase = getSupabase()

  // Si el concepto tiene fórmula y no se especificó monto, se calculará en la nómina
  const monto = payload.monto && payload.monto !== '' ? Number(payload.monto) : 0

  // Calcular fecha_fin si es prorrateado
  let fechaInicio = payload.fecha_inicio
  let fechaFin = payload.fecha_fin || payload.fecha_inicio
  let montoPeriodo = payload.monto_periodo || null

  if (payload.tipo_aplicacion === 'prorrateado' && montoPeriodo && Number(montoPeriodo) > 0) {
    const cuotas = Math.ceil(Number(monto) / Number(montoPeriodo))
    const inicio = new Date(fechaInicio)
    fechaFin = new Date(inicio.getFullYear(), inicio.getMonth() + cuotas - 1, inicio.getDate())
      .toISOString().slice(0, 10)
  }

  const { data, error } = await supabase.from('nomina_novedades').insert({
    company_id: companyId,
    empleado_id: payload.empleado_id,
    concepto_id: payload.concepto_id,
    periodo_id: payload.periodo_id,
    tipo_aplicacion: payload.tipo_aplicacion || 'unico',
    monto,
    monto_periodo: montoPeriodo ? Number(montoPeriodo) : null,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    descripcion: payload.descripcion || null,
  }).select('id').single()
  if (error) throw error; return data.id
}

export async function eliminarNovedad(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('nomina_novedades').delete().eq('id', id)
  if (error) throw error
}
