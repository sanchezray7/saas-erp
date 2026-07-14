import { getSupabase } from '@saas/core'

// === Turnos ===
export async function listarTurnos(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('turnos').select('*').eq('company_id', companyId).eq('activo', true).order('codigo')
  if (error) throw error; return data || []
}

export async function guardarTurno(companyId, payload) {
  const supabase = getSupabase()
  if (payload.id) {
    const { error } = await supabase.from('turnos').update({
      codigo: payload.codigo, nombre: payload.nombre, hora_entrada: payload.hora_entrada,
      hora_salida: payload.hora_salida, tolerancia_min: Number(payload.tolerancia_min) || 15,
      es_nocturno: payload.es_nocturno !== false, color: payload.color || '#3b82f6',
      horas_legales: payload.horas_legales ? Number(payload.horas_legales) : null,
    }).eq('id', payload.id)
    if (error) throw error; return payload.id
  }
  const { data, error } = await supabase.from('turnos').insert({
    company_id: companyId, ...payload,
  }).select('id').single()
  if (error) throw error; return data.id
}

export async function eliminarTurno(id) {
  const supabase = getSupabase(); const { error } = await supabase.from('turnos').delete().eq('id', id); if (error) throw error
}

// === Patrones ===
export async function listarPatrones(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('rotacion_patrones').select('*').eq('company_id', companyId).order('nombre')
  if (error) throw error
  // Agregar resumen de días
  for (const p of data || []) {
    const { data: dias } = await supabase.from('rotacion_patron_dias').select('*, turno:turno_id(codigo)').eq('patron_id', p.id).order('dia_pos')
    p.resumen_dias = (dias || []).map((d) => d.turno?.codigo || '—').join(' · ')
  }
  return data || []
}

export async function obtenerPatron(id) {
  const supabase = getSupabase()
  const { data: p, error } = await supabase.from('rotacion_patrones').select('*').eq('id', id).single()
  if (error) throw error
  if (!p) throw new Error('Patrón no encontrado')
  const { data: dias } = await supabase.from('rotacion_patron_dias').select('*, turno:turno_id(id, codigo, nombre, color)').eq('patron_id', id).order('dia_pos')
  return { ...p, dias: dias || [] }
}

export async function guardarPatron(companyId, payload) {
  const supabase = getSupabase()
  const dias = payload.dias || []
  let patronId = payload.id

  if (patronId) {
    const { error } = await supabase.from('rotacion_patrones').update({
      nombre: payload.nombre, descripcion: payload.descripcion || null,
    }).eq('id', patronId)
    if (error) throw error
    await supabase.from('rotacion_patron_dias').delete().eq('patron_id', patronId)
  } else {
    const { data, error } = await supabase.from('rotacion_patrones').insert({
      company_id: companyId, nombre: payload.nombre, descripcion: payload.descripcion || null,
    }).select('id').single()
    if (error) throw error
    patronId = data.id
  }

  if (dias.length > 0) {
    const { error: err2 } = await supabase.from('rotacion_patron_dias').insert(
      dias.map((d, i) => ({ patron_id: patronId, dia_pos: i, turno_id: d.turno_id || null }))
    )
    if (err2) throw err2
  }
  return patronId
}

export async function eliminarPatron(id) {
  const supabase = getSupabase(); const { error } = await supabase.from('rotacion_patrones').delete().eq('id', id); if (error) throw error
}

// === Rotación del empleado ===
export async function obtenerRotacionEmpleado(empleadoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('empleado_rotacion').select('*, patron:patron_id(*, dias:rotacion_patron_dias(*, turno:turno_id(*)))').eq('empleado_id', empleadoId).maybeSingle()
  if (error) throw error; return data
}

export async function guardarRotacion(companyId, empleadoId, payload) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('empleado_rotacion').upsert({
    company_id: companyId, empleado_id: empleadoId,
    patron_id: payload.patron_id, fecha_inicio: payload.fecha_inicio,
    dia_inicio: Number(payload.dia_inicio) || 0,
  }, { onConflict: 'company_id,empleado_id' }).select('id').single()
  if (error) throw error; return data.id
}

// === Calendarios (plantillas) ===
export async function listarCalendarios(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('calendarios').select('*, patron:patron_id(nombre)').eq('company_id', companyId).order('nombre')
  if (error) throw error; return data || []
}

async function calcularDias(patronId, diaInicio, desde, hasta) {
  const supabase = getSupabase()
  const { data: p } = await supabase.from('rotacion_patrones').select('*').eq('id', patronId).single()
  if (!p) throw new Error('Patrón no encontrado')
  const { data: dias } = await supabase.from('rotacion_patron_dias').select('*, turno:turno_id(codigo)').eq('patron_id', patronId).order('dia_pos')
  if (!dias || dias.length === 0) throw new Error('El patrón no tiene días configurados')

  const [ay, am, ad] = desde.split('-').map(Number)
  const [by, bm, bd] = hasta.split('-').map(Number)

  // Auto-alinear si es patrón de 7 días (posición 0 = Lunes)
  let dInicio = Number(diaInicio) || 0
  if (dias.length === 7) {
    const dayOfWeek = new Date(ay, am - 1, ad).getDay()
    dInicio = (dayOfWeek - 1 + 7) % 7
  }

  const inicio = new Date(ay, am - 1, ad)
  const fin = new Date(by, bm - 1, bd)
  const diffDays = Math.floor((fin.getTime() - inicio.getTime()) / 86400000) + 1
  const registros = []
  for (let i = 0; i < diffDays; i++) {
    const f = new Date(inicio.getTime() + i * 86400000)
    const fecha = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
    const pos = (i + dInicio) % dias.length
    registros.push({ fecha, turno_id: dias[pos].turno_id || null })
  }
  return registros
}

export async function crearCalendario(companyId, nombre, patronId, desde, hasta) {
  const supabase = getSupabase()
  const { data: cal, error } = await supabase.from('calendarios').insert({
    company_id: companyId, nombre, patron_id: patronId,
  }).select('id').single()
  if (error) throw error

  const dias = await calcularDias(patronId, 0, desde, hasta)
  if (dias.length > 0) {
    const { error: e2 } = await supabase.from('calendario_turnos').insert(
      dias.map((d) => ({ company_id: companyId, calendario_id: cal.id, fecha: d.fecha, turno_id: d.turno_id, origen: 'rotacion' }))
    )
    if (e2) throw e2
  }
  return cal.id
}

export async function regenerarCalendario(calendarioId, desde, hasta) {
  const supabase = getSupabase()
  const { data: cal } = await supabase.from('calendarios').select('*').eq('id', calendarioId).single()
  if (!cal) throw new Error('Calendario no encontrado')

  const dias = await calcularDias(cal.patron_id, 0, desde, hasta)
  await supabase.from('calendario_turnos').delete().eq('calendario_id', calendarioId)
  if (dias.length > 0) {
    const { error } = await supabase.from('calendario_turnos').insert(
      dias.map((d) => ({ company_id: cal.company_id, calendario_id: calendarioId, fecha: d.fecha, turno_id: d.turno_id, origen: 'rotacion' }))
    )
    if (error) throw error
  }
}

export async function eliminarCalendario(id) {
  const supabase = getSupabase()
  await supabase.from('calendario_turnos').delete().eq('calendario_id', id)
  await supabase.from('calendarios').delete().eq('id', id)
}

export async function listarDiasCalendario(calendarioId, desde, hasta) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('calendario_turnos').select('*, turno:turno_id(*)').eq('calendario_id', calendarioId).gte('fecha', desde).lte('fecha', hasta).order('fecha')
  if (error) throw error; return data || []
}

// === Asignación empleado → calendario ===
export async function asignarCalendarioAEmpleado(empleadoId, calendarioId) {
  const supabase = getSupabase()
  // Obtener company_id y patron_id del calendario
  const { data: emp } = await supabase.from('empleados').select('company_id').eq('id', empleadoId).single()
  if (!emp) throw new Error('Empleado no encontrado')
  const { data: cal } = await supabase.from('calendarios').select('patron_id').eq('id', calendarioId).single()
  // Upsert: si no existe rotación, la crea con el patrón del calendario
  const { error } = await supabase.from('empleado_rotacion').upsert({
    company_id: emp.company_id, empleado_id: empleadoId, calendario_id: calendarioId,
    patron_id: cal?.patron_id || null,
    fecha_inicio: new Date().toISOString().slice(0, 10), dia_inicio: 0,
  }, { onConflict: 'company_id,empleado_id' })
  if (error) throw error
}

export async function asignarCalendarioATodos(companyId, calendarioId) {
  const supabase = getSupabase()
  const { error } = await supabase.from('empleado_rotacion').update({ calendario_id: calendarioId }).eq('company_id', companyId)
  if (error) throw error
}

// === Consultar días por empleado (calendario + excepciones) ===
export async function obtenerCalendarioDeEmpleado(empleadoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('empleado_rotacion').select('calendario_id, calendario:calendario_id(id, nombre, patron_id)').eq('empleado_id', empleadoId).maybeSingle()
  if (error) throw error; return data
}

export async function listarDiasEmpleado(empleadoId, desde, hasta) {
  const supabase = getSupabase()
  // Obtener calendario asignado al empleado
  const rot = await obtenerCalendarioDeEmpleado(empleadoId)
  if (!rot?.calendario_id) return []

  // Obtener días del calendario
  const { data: dias } = await supabase.from('calendario_turnos').select('*, turno:turno_id(*)').eq('calendario_id', rot.calendario_id).gte('fecha', desde).lte('fecha', hasta).order('fecha')
  const result = dias || []

  // Obtener excepciones del empleado en el rango
  const { data: excs } = await supabase.from('calendario_turnos').select('*, turno:turno_id(*)').eq('empleado_id', empleadoId).eq('origen', 'excepcion').gte('fecha', desde).lte('fecha', hasta)
  // Aplicar excepciones: reemplazar días del calendario por la excepción
  const excMap = {}
  ;(excs || []).forEach((e) => { excMap[e.fecha] = e })
  return result.map((d) => excMap[d.fecha] || d)
}

// === Excepciones (per-empleado) ===
export async function guardarExcepcion(companyId, calendarioId, empleadoId, fecha, turnoId, motivo) {
  const supabase = getSupabase()
  // Upsert: si ya existe el (calendario_id, fecha) lo reemplaza
  const payload = {
    company_id: companyId, calendario_id: calendarioId,
    empleado_id: empleadoId || null, fecha,
    turno_id: turnoId || null, origen: 'excepcion', motivo: motivo || null,
  }
  const { error } = await supabase.from('calendario_turnos').upsert(payload, {
    onConflict: 'calendario_id,fecha',
  })
  if (error) throw error
}
