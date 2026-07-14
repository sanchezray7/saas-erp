import { getSupabase } from '@saas/core'

// === Asistencia diaria ===
export async function listarAsistencia(companyId, empleadoId, mes, anio) {
  const supabase = getSupabase()
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10) // último día del mes
  let query = supabase.from('asistencia').select('*').eq('company_id', companyId).gte('fecha', desde).lte('fecha', hasta).order('fecha')
  if (empleadoId) query = query.eq('empleado_id', empleadoId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function marcarAsistencia(companyId, empleadoId, payload) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('asistencia').upsert({
    company_id: companyId, empleado_id: empleadoId, ...payload,
  }, { onConflict: 'company_id,empleado_id,fecha' }).select('id').single()
  if (error) throw error
  return data.id
}

// === Tipos de ausencia ===
export async function listarAusenciaTipos(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('ausencia_tipos').select('*').eq('company_id', companyId).order('nombre')
  if (error) throw error
  return data || []
}

// === Ausencias ===
export async function listarAusencias(companyId, estado) {
  const supabase = getSupabase()
  let query = supabase.from('ausencias').select('*, empleado:empleado_id(nombre, apellido), tipo:ausencia_tipos!tipo_id(nombre, pagado)').eq('company_id', companyId).order('created_at', { ascending: false })
  if (estado) query = query.eq('estado', estado)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function listarAusenciasEmpleado(companyId, empleadoId, desde, hasta) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('ausencias')
    .select('*, tipo:ausencia_tipos!tipo_id(nombre)')
    .match({ company_id: companyId, empleado_id: empleadoId, estado: 'aprobado' })
    .gte('fecha_inicio', desde).lte('fecha_fin', hasta)
  if (error) throw error
  return data || []
}

export async function listarVacacionesEmpleado(companyId, empleadoId, desde, hasta) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('vacaciones_solicitudes')
    .select('*')
    .match({ company_id: companyId, empleado_id: empleadoId, estado: 'aprobado' })
    .gte('fecha_inicio', desde).lte('fecha_fin', hasta)
  if (error) throw error
  return data || []
}

export async function guardarAusencia(companyId, payload) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('ausencias').insert({
    company_id: companyId, empleado_id: payload.empleado_id, tipo_id: payload.tipo_id,
    fecha_inicio: payload.fecha_inicio, fecha_fin: payload.fecha_fin,
    motivo: payload.motivo || null, estado: 'pendiente',
  }).select('id').single()
  if (error) throw error
  return data.id
}

export async function aprobarAusencia(id, userId, estado) {
  const supabase = getSupabase()
  const { error } = await supabase.from('ausencias').update({ estado, aprobado_por: userId }).eq('id', id)
  if (error) throw error
}

// === Vacaciones (saldo) ===
export async function obtenerVacaciones(companyId, empleadoId, periodo) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('vacaciones').select('*').match({ company_id: companyId, empleado_id: empleadoId, periodo }).maybeSingle()
  if (error) throw error
  return data
}

export async function guardarVacaciones(companyId, empleadoId, periodo, diasAsignados) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('vacaciones').upsert({
    company_id: companyId, empleado_id: empleadoId, periodo, dias_asignados: diasAsignados,
  }, { onConflict: 'company_id,empleado_id,periodo' }).select('id').single()
  if (error) throw error
  return data.id
}

export async function actualizarAdicionalesVacaciones(id, diasAdicionales) {
  const supabase = getSupabase()
  const { data: vac } = await supabase.from('vacaciones').select('*').eq('id', id).single()
  if (!vac) throw new Error('Registro no encontrado')
  const total = Number(vac.dias_por_reglas || 0) + Number(diasAdicionales)
  const { error } = await supabase.from('vacaciones').update({ dias_adicionales: diasAdicionales, dias_asignados: total }).eq('id', id)
  if (error) throw error
}

// === Solicitudes de vacaciones ===
export async function listarSolicitudesVacaciones(companyId, empleadoId) {
  const supabase = getSupabase()
  let query = supabase.from('vacaciones_solicitudes').select('*, empleado:empleado_id(nombre, apellido)').eq('company_id', companyId).order('created_at', { ascending: false })
  if (empleadoId) query = query.eq('empleado_id', empleadoId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function solicitarVacaciones(companyId, payload) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('vacaciones_solicitudes').insert({
    company_id: companyId, empleado_id: payload.empleado_id,
    fecha_inicio: payload.fecha_inicio, fecha_fin: payload.fecha_fin, dias: payload.dias,
  }).select('id').single()
  if (error) throw error
  return data.id
}

export async function aprobarVacaciones(id, userId, estado) {
  const supabase = getSupabase()
  const { error } = await supabase.from('vacaciones_solicitudes').update({ estado, aprobado_por: userId }).eq('id', id)
  if (error) throw error
  // Si se aprueba, actualizar días disfrutados
  if (estado === 'aprobado') {
    const { data: sol } = await supabase.from('vacaciones_solicitudes').select('*').eq('id', id).single()
    if (sol) {
      const { data: vac } = await supabase.from('vacaciones').select('*').match({ company_id: sol.company_id, empleado_id: sol.empleado_id, periodo: sol.fecha_inicio.slice(0, 4) }).maybeSingle()
      if (vac) {
        await supabase.from('vacaciones').update({ dias_disfrutados: Number(vac.dias_disfrutados) + Number(sol.dias) }).eq('id', vac.id)
      }
    }
  }
}

// === Reglas de vacaciones ===
export async function listarReglasVacaciones(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('vacacion_reglas').select('*').eq('company_id', companyId).order('desde_anios')
  if (error) throw error
  return data || []
}

export async function guardarReglaVacacion(companyId, payload) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('vacacion_reglas').insert({
    company_id: companyId, desde_anios: payload.desde_anios, hasta_anios: payload.hasta_anios, dias: payload.dias,
  }).select('id').single()
  if (error) throw error
  return data.id
}

export async function eliminarReglaVacacion(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('vacacion_reglas').delete().eq('id', id)
  if (error) throw error
}

// === Cálculo automático ===
export function calcularDiasPorAntiguedad(reglas, anios) {
  const regla = reglas.find((r) => anios >= r.desde_anios && anios <= r.hasta_anios)
  return regla ? Number(regla.dias) : 0
}
