import { getSupabase } from '@saas/core'

function toMin(hora) {
  if (!hora) return null
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function fmtMin(min) {
  if (min == null) return '—'
  const sign = min < 0 ? '-' : ''
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export { fmtMin }

export async function obtenerHorarioActivo(empleadoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('empleado_horarios').select('*').eq('empleado_id', empleadoId).is('vigencia_hasta', null).maybeSingle()
  if (error) throw error
  return data
}

export async function guardarHorario(companyId, empleadoId, payload) {
  const supabase = getSupabase()
  await supabase.from('empleado_horarios').update({ vigencia_hasta: new Date().toISOString().slice(0, 10) }).eq('empleado_id', empleadoId).is('vigencia_hasta', null)
  const { data, error } = await supabase.from('empleado_horarios').insert({
    company_id: companyId, empleado_id: empleadoId, vigencia_desde: new Date().toISOString().slice(0, 10),
    hora_entrada: payload.hora_entrada, hora_salida: payload.hora_salida,
    tolerancia_min: Number(payload.tolerancia_min) || 15,
  }).select('id').single()
  if (error) throw error
  return data.id
}

export async function generarReporteAsistencia(companyId, desde, hasta, empleadoId = null) {
  const supabase = getSupabase()

  let query = supabase.from('empleados').select('id, nombre, apellido, codigo_biometrico').eq('company_id', companyId).eq('activo', true).order('apellido')
  if (empleadoId) query = query.eq('id', empleadoId)
  const { data: empleados } = await query
  if (!empleados) return []

  const resultado = []

  for (const emp of empleados) {
    const horario = await obtenerHorarioActivo(emp.id)

    // Intentar desde control_horario (más preciso)
    const { data: controlRows } = await supabase
      .from('control_horario')
      .select('*')
      .match({ company_id: companyId, empleado_id: emp.id })
      .gte('fecha', desde).lte('fecha', hasta)
      .order('fecha')

    if (controlRows && controlRows.length > 0) {
      let totalHs = 0; let totalAtrasos = 0; let totalSalidasTemp = 0
      let totalExtra50 = 0; let totalExtra100 = 0; let totalExtra130 = 0
      let dias = 0
      const detalle = []

      for (const r of controlRows) {
        if (r.es_ausente || r.motivo_ausencia) continue
        if (!r.entrada_real) continue
        dias++
        totalHs += r.minutos_trabajados || 0
        totalAtrasos += r.minutos_atraso || 0
        totalSalidasTemp += r.minutos_salida_temp || 0
        totalExtra50 += r.minutos_extra_50 || 0
        totalExtra100 += r.minutos_extra_100 || 0
        totalExtra130 += r.minutos_extra_130 || 0

        detalle.push({
          fecha: r.fecha,
          entrada: r.entrada_real?.slice(0, 5),
          salida: r.salida_real?.slice(0, 5),
          esperadaEntrada: r.entrada_planificada?.slice(0, 5),
          esperadaSalida: r.salida_planificada?.slice(0, 5),
          atraso: r.minutos_atraso || 0,
          salidaTemp: r.minutos_salida_temp || 0,
          hsExtra: (r.minutos_extra_50 || 0) + (r.minutos_extra_100 || 0) + (r.minutos_extra_130 || 0),
          hsExtra50: r.minutos_extra_50 || 0,
          hsExtra100: r.minutos_extra_100 || 0,
          hsExtra130: r.minutos_extra_130 || 0,
          hsTrab: r.minutos_trabajados || 0,
        })
      }

      resultado.push({
        ...emp, horario,
        dias, hsTrab: totalHs, atrasos: totalAtrasos,
        hsExtra: totalExtra50 + totalExtra100 + totalExtra130,
        hsExtra50: totalExtra50, hsExtra100: totalExtra100, hsExtra130: totalExtra130,
        salidasTemprano: totalSalidasTemp, detalle,
      })
    } else {
      // Fallback: cálculo manual desde asistencia
      const { data: asistencias } = await supabase.from('asistencia').select('*').match({ company_id: companyId, empleado_id: emp.id }).gte('fecha', desde).lte('fecha', hasta).order('fecha')

      if (!asistencias || asistencias.length === 0) {
        resultado.push({ ...emp, horario, dias: 0, hsTrab: 0, atrasos: 0, hsExtra: 0, hsExtra50: 0, hsExtra100: 0, hsExtra130: 0, salidasTemprano: 0, detalle: [] })
        continue
      }

      let totalHs = 0; let totalAtrasos = 0; let totalHsExtra = 0; let totalSalidasTemp = 0
      let totalExtra50 = 0; let totalExtra100 = 0; let totalExtra130 = 0
      let dias = 0
      const detalle = []

      for (const a of asistencias) {
        if (!a.hora_entrada) continue
        dias++

        const entradaMin = toMin(a.hora_entrada)
        const salidaMin = toMin(a.hora_salida)
        const esperadaEntrada = horario ? toMin(horario.hora_entrada) : null
        const esperadaSalida = horario ? toMin(horario.hora_salida) : null
        const tolerancia = horario?.tolerancia_min || 15

        let hsTrab = 0
        if (entradaMin != null && salidaMin != null) {
          hsTrab = salidaMin >= entradaMin ? salidaMin - entradaMin : (salidaMin + 1440) - entradaMin
          totalHs += hsTrab
        }

        let atraso = 0
        if (entradaMin != null && esperadaEntrada != null) {
          atraso = Math.max(0, entradaMin - esperadaEntrada - tolerancia)
          totalAtrasos += atraso
        }

        let salidaTemp = 0
        if (salidaMin != null && esperadaSalida != null) {
          salidaTemp = Math.max(0, esperadaSalida - salidaMin)
          totalSalidasTemp += salidaTemp
        }

        let hsExtra = 0; let hsExtra50 = 0; let hsExtra130 = 0
        if (salidaMin != null && esperadaSalida != null) {
          hsExtra = Math.max(0, salidaMin - esperadaSalida)
          totalHsExtra += hsExtra

          const pSalida = esperadaSalida
          for (let m = pSalida; m < salidaMin; m++) {
            const h = Math.floor((m % 1440) / 60)
            if (h >= 6 && h < 20) hsExtra50++
            else hsExtra130++
          }
          totalExtra50 += hsExtra50
          totalExtra100 += 0
          totalExtra130 += hsExtra130
        }

        detalle.push({
          fecha: a.fecha,
          entrada: a.hora_entrada?.slice(0, 5),
          salida: a.hora_salida?.slice(0, 5),
          esperadaEntrada: horario?.hora_entrada?.slice(0, 5),
          esperadaSalida: horario?.hora_salida?.slice(0, 5),
          atraso, salidaTemp, hsExtra,
          hsExtra50, hsExtra100: 0, hsExtra130,
          hsTrab,
        })
      }

      resultado.push({
        ...emp, horario,
        dias, hsTrab: totalHs, atrasos: totalAtrasos,
        hsExtra: totalHsExtra, hsExtra50: totalExtra50, hsExtra100: totalExtra100, hsExtra130: totalExtra130,
        salidasTemprano: totalSalidasTemp, detalle,
      })
    }
  }

  return resultado
}
