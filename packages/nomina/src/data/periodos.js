import { getSupabase } from '@saas/core'
import { generarAsientoNomina, generarAsientoPagoNomina } from '@saas/accounting'

export async function previsualizarAsientoNomina(periodoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('generar_asiento_nomina', { p_periodo_id: periodoId, p_preview: true })
  if (error) throw error
  return data
}

function redondear(monto, moneda) {
  if (!moneda || moneda === 'PYG') return Math.round(monto)
  return Math.round(monto * 100) / 100
}

// Evalúa una fórmula de concepto con variables del contexto
function evaluarFormula(formula, ctx) {
  if (!formula || typeof formula !== 'string') return 0
  try {
    // Mapear variables del contexto
    const vars = {
      'salario_contrato': ctx.salarioBase || 0,
      'salario_base': ctx.salarioBase || 0,
      'valor_hora': ctx.valorHora || 0,
      'valor_hora_extra': ctx.valorHora || 0,
      'diario': ctx.diario || 0,
      'dias_trabajados': ctx.diasTrab || 0,
      'dias_salario': ctx.diasSalario || 0,
      'dias_ausencia': ctx.diasAusenteReal || 0,
      'dias_vacaciones': ctx.diasVacaciones || 0,
      'he50_min': ctx.he50 || 0,
      'he100_min': ctx.he100 || 0,
      'he130_min': ctx.he130 || 0,
      'noct_min': ctx.noct || 0,
      'salario': ctx.salarioBase || 0,
      'base_ips': ctx['BASE_IPS'] || ctx.baseIPS || 0,
      'base_irp': ctx['BASE_IRP'] || ctx.baseIRP || 0,
      'minutos_totales': ctx.minTrab || 0,
      'BASE_IPS': ctx['BASE_IPS'] || ctx.baseIPS || 0,
      'BASE_IRP': ctx['BASE_IRP'] || ctx.baseIRP || 0,
      'suma_imponible_ips': ctx['BASE_IPS'] || ctx.baseIPS || 0,
      'suma_imponible_irp': ctx['BASE_IRP'] || ctx.baseIRP || 0,
    }
    // Reemplazar variables en la fórmula (ordenado por longitud, más largas primero)
    let expr = formula
    const varsSorted = Object.entries(vars).sort((a, b) => b[0].length - a[0].length)
    for (const [key, val] of varsSorted) {
      expr = expr.replaceAll(key, `(${val})`)
    }
    // También reemplazar códigos de concepto desde el contexto (ej: IPS_PATRONAL → valor)
    const ctxEntries = Object.entries(ctx).sort((a, b) => b[0].length - a[0].length)
    for (const [key, val] of ctxEntries) {
      if (vars[key] !== undefined) continue
      if (typeof val !== 'number') continue
      expr = expr.replaceAll(key, `(${val})`)
    }
    // Evaluar expresión matemática
    const result = new Function('return (' + expr + ')')()
    return isFinite(result) ? result : 0
  } catch (e) {
    return 0
  }
}

export function fmtMonto(monto, moneda) {
  if (monto == null) return '—'
  const num = Number(monto)
  if (!moneda || moneda === 'PYG') return `${num.toLocaleString('es-PY')}`
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export async function listarPeriodos(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('nomina_periodos').select('*').eq('company_id', companyId).order('fecha_desde', { ascending: false })
  if (error) throw error; return data || []
}

export async function crearPeriodo(companyId, payload) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('nomina_periodos').insert({
    company_id: companyId, nombre: payload.nombre,
    fecha_desde: payload.fecha_desde, fecha_hasta: payload.fecha_hasta,
    fecha_pago: payload.fecha_pago || null,
    frecuencia: payload.frecuencia || 'mensual',
    tipo: payload.tipo || 'ordinario',
  }).select('id').single()
  if (error) throw error; return data.id
}

export async function eliminarPeriodo(id) {
  const supabase = getSupabase(); const { error } = await supabase.from('nomina_periodos').delete().eq('id', id); if (error) throw error
}

export async function calcularPeriodo(periodoId) {
  const supabase = getSupabase()
  const { data: periodo } = await supabase.from('nomina_periodos').select('*').eq('id', periodoId).single()
  if (!periodo) throw new Error('Período no encontrado')

  // Obtener control_horario del período
  const { data: control } = await supabase.from('control_horario').select('*, empleado:empleado_id(id)').eq('company_id', periodo.company_id).gte('fecha', periodo.fecha_desde).lte('fecha', periodo.fecha_hasta)
  const { data: ausencias } = await supabase.from('ausencias').select('*').eq('company_id', periodo.company_id).eq('estado', 'aprobado').gte('fecha_inicio', periodo.fecha_desde).lte('fecha_fin', periodo.fecha_hasta)
  const { data: vacaciones } = await supabase.from('vacaciones_solicitudes').select('*').eq('company_id', periodo.company_id).eq('estado', 'aprobado').gte('fecha_inicio', periodo.fecha_desde).lte('fecha_fin', periodo.fecha_hasta)
  const { data: conceptos } = await supabase.from('nomina_conceptos').select('*').eq('company_id', periodo.company_id).eq('activo', true).order('orden')

  // Agrupar control horario
  const controlPorEmp = {}
  for (const c of control || []) {
    if (!controlPorEmp[c.empleado_id]) controlPorEmp[c.empleado_id] = { he50: 0, he100: 0, he130: 0, noct: 0, trab: 0, dias: 0 }
    controlPorEmp[c.empleado_id].he50 += c.minutos_extra_50 || 0
    controlPorEmp[c.empleado_id].he100 += c.minutos_extra_100 || 0
    controlPorEmp[c.empleado_id].he130 += c.minutos_extra_130 || 0
    controlPorEmp[c.empleado_id].noct += c.minutos_nocturnos || 0
    controlPorEmp[c.empleado_id].trab += c.minutos_trabajados || 0
    if (c.minutos_trabajados > 0) controlPorEmp[c.empleado_id].dias++
  }

  // Agrupar ausencias
  const ausenciasPorEmp = {}
  for (const a of ausencias || []) {
    if (!ausenciasPorEmp[a.empleado_id]) ausenciasPorEmp[a.empleado_id] = 0
    const inicio = new Date(a.fecha_inicio)
    const fin = new Date(a.fecha_fin)
    ausenciasPorEmp[a.empleado_id] += Math.max(1, Math.floor((fin.getTime() - inicio.getTime()) / 86400000) + 1)
  }

  // Agrupar vacaciones
  const vacacionesPorEmp = {}
  for (const v of vacaciones || []) {
    if (!vacacionesPorEmp[v.empleado_id]) vacacionesPorEmp[v.empleado_id] = 0
    const inicio = new Date(v.fecha_inicio)
    const fin = new Date(v.fecha_fin)
    vacacionesPorEmp[v.empleado_id] += Math.max(1, Math.floor((fin.getTime() - inicio.getTime()) / 86400000) + 1)
  }

  // Obtener empleados activos
  const { data: empList } = await supabase.from('empleados').select('id, nombre, apellido').eq('company_id', periodo.company_id).eq('activo', true)
  const empleados = []
  for (const emp of empList || []) {
    const { data: c } = await supabase.from('empleado_contratos').select('*').eq('empleado_id', emp.id).is('vigencia_hasta', null).maybeSingle()
    if (!c || !c.salario || Number(c.salario) <= 0) continue
    const freq = c.frecuencia_pago || 'mensual'
    if (freq !== periodo.frecuencia) continue
    empleados.push({ ...emp, contrato_activo: c })
  }

  // Eliminar detalle anterior
  const { data: detallesPrev } = await supabase.from('nomina_detalle').select('id').eq('periodo_id', periodoId)
  const idsPrev = (detallesPrev || []).map((d) => d.id)
  if (idsPrev.length > 0) {
    await supabase.from('nomina_lineas').delete().in('nomina_detalle_id', idsPrev)
    await supabase.from('nomina_detalle').delete().in('id', idsPrev)
  }

  let totalEmpleados = 0

  // Mapa de conceptos activos por código (para lookup rápido)
  const { data: conceptosData } = await supabase.from('nomina_conceptos').select('*').eq('company_id', periodo.company_id).eq('activo', true).order('orden')
  // Fallback: si no hay conceptos activos, traer todos
  let conceptosList = conceptosData || []
  if (conceptosList.length === 0) {
    const { data: fallback } = await supabase.from('nomina_conceptos').select('*').eq('company_id', periodo.company_id).order('orden')
    conceptosList = fallback || []
  }
  const conceptosMap = {}
  for (const c of conceptosList) conceptosMap[c.codigo] = c

  // --- ADELANTO: cálculo simple (% del salario base) ---
  if (periodo.tipo === 'adelanto') {
    const cADELANTO = conceptosMap['ADELANTO_PAGADO'] || await supabase.from('nomina_conceptos').select('id, porcentaje').match({ company_id: periodo.company_id, codigo: 'ADELANTO_PAGADO' }).maybeSingle().then((r) => r.data)
    const pctAdelanto = Number(conceptosMap['ADELANTO_QUINCENAL']?.porcentaje) || 50
    for (const emp of empleados || []) {
      const c = emp.contrato_activo
      if (!c || !c.salario) continue
      const salarioBase = Number(c.salario)
      const moneda = c.moneda || 'PYG'
      const montoAdelanto = redondear(salarioBase * pctAdelanto / 100, moneda)

      const { data: detalle } = await supabase.from('nomina_detalle').insert({
        company_id: periodo.company_id, periodo_id: periodoId, empleado_id: emp.id,
        dias_trabajados: 0, horas_legales_total: 0, valor_hora: 0,
        salario_base: salarioBase, total_remunerativo: montoAdelanto,
        total_deducciones: 0, total_aporte_patronal: 0,
        neto_pagar: montoAdelanto,
      }).select('id').single()
      if (!detalle) continue

      if (cADELANTO) {
        await supabase.from('nomina_lineas').insert({
          company_id: periodo.company_id, nomina_detalle_id: detalle.id,
          concepto_id: cADELANTO.id, cantidad: 1,
          monto_unitario: montoAdelanto, monto_total: montoAdelanto,
          origen: 'adelanto',
        })
      }
      totalEmpleados++
    }
    await supabase.from('nomina_periodos').update({ estado: 'calculado' }).eq('id', periodoId)
    return totalEmpleados
  }

  // --- AGUINALDO: suma de prorrateos del año ---
  if (periodo.tipo === 'aguinaldo') {
    const anyo = periodo.fecha_desde?.slice(0, 4)
    const cAGUINALDO = conceptosMap['AGUINALDO'] || await supabase.from('nomina_conceptos').select('id').match({ company_id: periodo.company_id, codigo: 'AGUINALDO' }).maybeSingle().then((r) => r.data)
    const cPRORRATEO = conceptosMap['PRORRATEO_AGUINALDO'] || await supabase.from('nomina_conceptos').select('id').match({ company_id: periodo.company_id, codigo: 'PRORRATEO_AGUINALDO' }).maybeSingle().then((r) => r.data)

    // Períodos del año (todos los que puedan tener prorrateos)
    const { data: ordPeriodos } = await supabase
      .from('nomina_periodos')
      .select('id')
      .eq('company_id', periodo.company_id)
      .not('tipo', 'eq', 'adelanto')
      .not('tipo', 'eq', 'aguinaldo')
      .gte('fecha_desde', `${anyo}-01-01`)
      .lte('fecha_hasta', `${anyo}-12-31`)
    const ordIds = (ordPeriodos || []).map((p) => p.id)

    for (const emp of empleados || []) {
      const c = emp.contrato_activo
      if (!c || !c.salario) continue
      const salarioBase = Number(c.salario)
      const moneda = c.moneda || 'PYG'

      // Buscar detalles del empleado en períodos del año
      const { data: detalles } = await supabase
        .from('nomina_detalle')
        .select('id')
        .in('periodo_id', ordIds)
        .eq('empleado_id', emp.id)

      let montoAguinaldo = 0
      if (detalles && detalles.length > 0 && cPRORRATEO) {
        const detIds = detalles.map((d) => d.id)
        const { data: lines } = await supabase
          .from('nomina_lineas')
          .select('monto_total')
          .in('nomina_detalle_id', detIds)
          .eq('concepto_id', cPRORRATEO.id)
        montoAguinaldo = (lines || []).reduce((s, l) => s + Number(l.monto_total), 0)
        montoAguinaldo = redondear(montoAguinaldo, moneda)
      }

      if (montoAguinaldo <= 0) continue

      const { data: detalle } = await supabase.from('nomina_detalle').insert({
        company_id: periodo.company_id, periodo_id: periodoId, empleado_id: emp.id,
        dias_trabajados: 0, horas_legales_total: 0, valor_hora: 0,
        salario_base: salarioBase, total_remunerativo: montoAguinaldo,
        total_deducciones: 0, total_aporte_patronal: 0,
        neto_pagar: montoAguinaldo,
      }).select('id').single()
      if (!detalle) continue

      if (cAGUINALDO) {
        await supabase.from('nomina_lineas').insert({
          company_id: periodo.company_id, nomina_detalle_id: detalle.id,
          concepto_id: cAGUINALDO.id, cantidad: 1,
          monto_unitario: montoAguinaldo, monto_total: montoAguinaldo,
          origen: 'aguinaldo',
        })
      }
      totalEmpleados++
    }
    await supabase.from('nomina_periodos').update({ estado: 'calculado' }).eq('id', periodoId)
    return totalEmpleados
  }

  // --- EXTRAORDINARIO: solo novedades manuales ---
  if (periodo.tipo === 'extraordinario') {
    const { data: novExtra } = await supabase.from('nomina_novedades').select('*, concepto:concepto_id(codigo, tipo)').eq('periodo_id', periodoId)
    const novPorEmp = {}
    for (const n of novExtra || []) {
      if (!novPorEmp[n.empleado_id]) novPorEmp[n.empleado_id] = []
      novPorEmp[n.empleado_id].push(n)
    }
    for (const emp of empleados || []) {
      const c = emp.contrato_activo
      if (!c || !c.salario) continue
      const salarioBase = Number(c.salario)
      const moneda = c.moneda || 'PYG'
      let totalRem = 0, totalDed = 0
      const lines = []
      for (const n of novPorEmp[emp.id] || []) {
        const conc = n.concepto
        if (!conc) continue
        const monto = Number(n.monto) || 0
        if (conc.tipo === 'remunerativo') totalRem += monto
        else if (conc.tipo === 'deduccion') totalDed += monto
        lines.push({ c: conc.codigo, cantidad: 1, unitario: monto, monto })
      }
      const neto = redondear(totalRem - totalDed, moneda)
      const { data: detalle } = await supabase.from('nomina_detalle').insert({
        company_id: periodo.company_id, periodo_id: periodoId, empleado_id: emp.id,
        dias_trabajados: 0, horas_legales_total: 0, valor_hora: 0,
        salario_base: salarioBase, total_remunerativo: redondear(totalRem, moneda),
        total_deducciones: redondear(totalDed, moneda), total_aporte_patronal: 0,
        neto_pagar: neto,
      }).select('id').single()
      if (!detalle) continue
      for (const l of lines) {
        const concDB = conceptosMap[l.c] || await supabase.from('nomina_conceptos').select('id, tipo').match({ company_id: periodo.company_id, codigo: l.c }).maybeSingle().then((r) => r.data)
        if (!concDB) continue
        const sign = concDB.tipo === 'deduccion' ? -1 : 1
        await supabase.from('nomina_lineas').insert({
          company_id: periodo.company_id, nomina_detalle_id: detalle.id,
          concepto_id: concDB.id, cantidad: 1,
          monto_unitario: redondear(l.monto * sign, moneda),
          monto_total: redondear(l.monto * sign, moneda),
          origen: 'manual',
        })
      }
      totalEmpleados++
    }
    await supabase.from('nomina_periodos').update({ estado: 'calculado' }).eq('id', periodoId)
    return totalEmpleados
  }

  // Cargar novedades del período y aplicar lógica de cuotas

  // Cargar novedades del período y aplicar lógica de cuotas
  let { data: novedades } = await supabase.from('nomina_novedades').select('*, concepto:concepto_id(codigo, tipo)').eq('periodo_id', periodoId)

  // Para complementario: incluir novedades del período original
  if (periodo.tipo === 'complementario') {
    const { data: origPeriodos } = await supabase
      .from('nomina_periodos')
      .select('id')
      .eq('company_id', periodo.company_id)
      .eq('fecha_desde', periodo.fecha_desde)
      .eq('fecha_hasta', periodo.fecha_hasta)
      .neq('tipo', 'complementario')
    const origIds = (origPeriodos || []).map((p) => p.id)
    if (origIds.length > 0) {
      const { data: origNovedades } = await supabase
        .from('nomina_novedades')
        .select('*, concepto:concepto_id(codigo, tipo)')
        .in('periodo_id', origIds)
      novedades = [...(novedades || []), ...(origNovedades || [])]
    }
  }
  const novedadesPorEmp = {}
  for (const n of novedades || []) {
    if (n.fecha_inicio > periodo.fecha_hasta || n.fecha_fin < periodo.fecha_desde) continue

    let montoAplicar = Number(n.monto) || 0
    if (n.tipo_aplicacion === 'prorrateado' && n.monto_periodo) {
      montoAplicar = Number(n.monto_periodo)
    }
    if (n.tipo_aplicacion === 'unico') {
      const unicaFecha = n.fecha_inicio
      if (unicaFecha < periodo.fecha_desde || unicaFecha > periodo.fecha_hasta) continue
    }

    if (!novedadesPorEmp[n.empleado_id]) novedadesPorEmp[n.empleado_id] = []
    novedadesPorEmp[n.empleado_id].push({ ...n, montoAplicar })
  }

  for (const emp of empleados || []) {
    const contrato = emp.contrato_activo
    if (!contrato || !contrato.salario) continue
    const salarioBase = Number(contrato.salario)
    const moneda = contrato.moneda || 'PYG'
    const ctrl = controlPorEmp[emp.id] || {}
    const diasAusenteReal = ausenciasPorEmp[emp.id] || 0
    const diasVacaciones = vacacionesPorEmp[emp.id] || 0
    const diasTrab = ctrl.dias || 0
    const valorHora = salarioBase / 30 / 8
    const diario = salarioBase / 30
    const diasSalario = Math.max(0, 30 - diasAusenteReal - diasVacaciones)

    // --- NUEVO: cálculos por fórmula ---
    const lineas = []
    const ctxFormula = { salarioBase, valorHora, diario, diasTrab, diasSalario, diasAusenteReal, diasVacaciones, he50: ctrl.he50 || 0, he100: ctrl.he100 || 0, he130: ctrl.he130 || 0, noct: ctrl.noct || 0, minTrab: ctrl.trab || 0 }

    // Obtener conceptos activos ordenados por orden_calculo
    const conceptosPorOrden = Object.entries(conceptosMap)
      .filter(([_, c]) => c.activo !== false && (c.formula || c.codigo === 'BASE_IPS' || c.codigo === 'BASE_IRP'))
      .sort((a, b) => (a[1].orden_calculo || 999) - (b[1].orden_calculo || 999))

    for (const [cod, conc] of conceptosPorOrden) {
      let montoFormula = 0

      // BASE_IPS: suma automática de conceptos con ips=true
      if (cod === 'BASE_IPS') {
        montoFormula = lineas.filter((l) => l.ips).reduce((s, l) => s + l.monto, 0)
      }
      // BASE_IRP: suma automática de conceptos con irp=true
      else if (cod === 'BASE_IRP') {
        montoFormula = lineas.filter((l) => l.irp).reduce((s, l) => s + l.monto, 0)
      }
      // Conceptos con fórmula
      else if (conc.formula) {
        // Pasar contexto + valores de conceptos previos
        const ctxCompleto = { ...ctxFormula }
        for (const l of lineas) { ctxCompleto[l.c] = l.monto }
        montoFormula = redondear(evaluarFormula(conc.formula, ctxCompleto), moneda)
      }

      if (montoFormula === 0) continue
      ctxFormula[cod] = montoFormula
      const montoLinea = montoFormula > 0 ? montoFormula : montoFormula
      lineas.push({ c: cod, cantidad: 1, unitario: Math.abs(montoFormula), monto: montoFormula, ips: conc.es_imponible_ips === true, irp: conc.es_imponible_irp === true })
    }

    // Cargar novedades del empleado
    let totalNovRem = 0, totalNovDed = 0, aporteNovIPS = 0
    const empNov = novedadesPorEmp[emp.id] || []
    for (const n of empNov) {
      const conc = conceptosMap[n.concepto?.codigo] || await supabase.from('nomina_conceptos').select('*').match({ company_id: periodo.company_id, codigo: n.concepto?.codigo }).maybeSingle().then((r) => r.data)
      if (!conc) continue
      const monto = Number(n.montoAplicar) || 0
      if (conc.tipo === 'remunerativo') totalNovRem += monto
      else if (conc.tipo === 'deduccion') totalNovDed += monto
      if (conc.es_imponible_ips) aporteNovIPS += monto
    }

    // Totales (solo conceptos que afectan el neto)
    const totalRem = lineas.filter((l) => conceptosMap[l.c]?.tipo === 'remunerativo').reduce((s, l) => s + Math.abs(l.monto), 0) + totalNovRem
    const totalDed = lineas.filter((l) => conceptosMap[l.c]?.tipo === 'deduccion').reduce((s, l) => s + Math.abs(l.monto), 0) + totalNovDed
    const neto = totalRem - totalDed

    // Insertar detalle
    const totalAportePatronal = lineas.filter((l) => conceptosMap[l.c]?.tipo === 'aporte_patronal').reduce((s, l) => s + l.monto, 0)
    const { data: detalle } = await supabase.from('nomina_detalle').insert({
      company_id: periodo.company_id, periodo_id: periodoId, empleado_id: emp.id,
      dias_trabajados: diasTrab, horas_legales_total: diasTrab * 8,
      valor_hora: redondear(valorHora, moneda),
      salario_base: salarioBase,
      total_remunerativo: redondear(totalRem, moneda),
      total_deducciones: redondear(totalDed, moneda),
      total_aporte_patronal: redondear(totalAportePatronal, moneda),
      neto_pagar: redondear(neto, moneda),
    }).select('id').single()
    if (!detalle) continue

    // Insertar líneas desde lineas
    for (const l of lineas) {
      const conc = conceptosMap[l.c] || await supabase.from('nomina_conceptos').select('id, tipo').match({ company_id: periodo.company_id, codigo: l.c }).maybeSingle().then((r) => r.data)
      if (!conc) continue
      const sign = conc.tipo === 'deduccion' ? -1 : 1
      await supabase.from('nomina_lineas').insert({
        company_id: periodo.company_id, nomina_detalle_id: detalle.id, concepto_id: conc.id,
        cantidad: l.cantidad ?? 1, monto_unitario: redondear((l.unitario ?? l.monto) * sign, moneda), monto_total: redondear(l.monto * sign, moneda), origen: 'fijo',
      })
    }

    // Novedades del período para este empleado
    const codsEnLineas = new Set(lineas.map((l) => l.c))
    for (const n of empNov) {
      const conc = conceptosMap[n.concepto?.codigo] || await supabase.from('nomina_conceptos').select('id, tipo').match({ company_id: periodo.company_id, codigo: n.concepto?.codigo }).maybeSingle().then((r) => r.data)
      if (!conc) continue
      // Si el concepto ya fue calculado por fórmula, no duplicar desde novedad
      if (codsEnLineas.has(conc.codigo)) continue
      const sign = conc.tipo === 'deduccion' ? -1 : 1
      const monto = Number(n.montoAplicar) || 0
      await supabase.from('nomina_lineas').insert({
        company_id: periodo.company_id, nomina_detalle_id: detalle.id, concepto_id: conc.id,
        cantidad: 1, monto_unitario: monto * sign, monto_total: monto * sign, origen: 'manual',
      })
    }

    totalEmpleados++
  }

  // --- COMPLEMENTARIO: convertir montos a diferencias vs período original ---
  if (periodo.tipo === 'complementario') {
    const { data: origPeriodos } = await supabase
      .from('nomina_periodos')
      .select('id')
      .eq('company_id', periodo.company_id)
      .eq('fecha_desde', periodo.fecha_desde)
      .eq('fecha_hasta', periodo.fecha_hasta)
      .neq('tipo', 'complementario')
    const origIds = (origPeriodos || []).map((p) => p.id)

    if (origIds.length > 0) {
      const { data: origDetalles } = await supabase
        .from('nomina_detalle')
        .select('id, empleado_id')
        .in('periodo_id', origIds)
      const origDetIds = (origDetalles || []).map((d) => d.id)
      const origMontos = {} // { empleado_id: { 'SALARIO': 500000, 'IPS': -45000, ... } }
      if (origDetIds.length > 0) {
        const { data: origLines } = await supabase
          .from('nomina_lineas')
          .select('monto_total, nomina_detalle_id, concepto:concepto_id(codigo)')
          .in('nomina_detalle_id', origDetIds)
        for (const l of origLines || []) {
          const det = (origDetalles || []).find((d) => d.id === l.nomina_detalle_id)
          if (!det || !l.concepto?.codigo) continue
          if (!origMontos[det.empleado_id]) origMontos[det.empleado_id] = {}
          origMontos[det.empleado_id][l.concepto.codigo] = Number(l.monto_total)
        }
      }

      // Cargar líneas del complementario recién calculadas
      const { data: nuevosDetalles } = await supabase
        .from('nomina_detalle')
        .select('id, empleado_id, total_remunerativo, total_deducciones, neto_pagar')
        .eq('periodo_id', periodoId)
      const nuevosDetIds = (nuevosDetalles || []).map((d) => d.id)
      if (nuevosDetIds.length > 0) {
        const { data: nuevasLineas } = await supabase
          .from('nomina_lineas')
          .select('id, monto_total, nomina_detalle_id, concepto:concepto_id(codigo, tipo)')
          .in('nomina_detalle_id', nuevosDetIds)
        const porDetalle = {}
        for (const nl of nuevasLineas || []) {
          if (!porDetalle[nl.nomina_detalle_id]) porDetalle[nl.nomina_detalle_id] = []
          porDetalle[nl.nomina_detalle_id].push(nl)
        }

        for (const nd of nuevosDetalles || []) {
          const orig = origMontos[nd.empleado_id] || {}
          const lines = porDetalle[nd.id] || []

          let totalRem = 0, totalDed = 0
          let keepDetalle = false

          for (const nl of lines) {
            const cod = nl.concepto?.codigo
            if (!cod) continue
            const origMonto = orig[cod] || 0
            const newMonto = Number(nl.monto_total)
            const diff = newMonto - origMonto

            if (diff === 0) {
              await supabase.from('nomina_lineas').delete().eq('id', nl.id)
            } else {
              await supabase.from('nomina_lineas').update({
                monto_unitario: diff,
                monto_total: diff,
              }).eq('id', nl.id)
              keepDetalle = true
              // no_remunerativo y aporte_patronal no afectan neto
              if (nl.concepto?.tipo === 'no_remunerativo' || nl.concepto?.tipo === 'aporte_patronal') continue
              if (diff > 0) totalRem += diff
              else totalDed += Math.abs(diff)
            }
          }

          if (!keepDetalle) {
            await supabase.from('nomina_detalle').delete().eq('id', nd.id)
            totalEmpleados--
          } else {
            await supabase.from('nomina_detalle').update({
              total_remunerativo: totalRem,
              total_deducciones: totalDed,
              neto_pagar: totalRem - totalDed,
            }).eq('id', nd.id)
          }
        }
      }
    }
  }

  // --- DEDUCIR ADELANTOS (solo en períodos ordinarios) ---
  if (periodo.tipo === 'ordinario') {
    const { data: adelantosPeriodos } = await supabase
      .from('nomina_periodos')
      .select('id, nombre')
      .eq('company_id', periodo.company_id)
      .eq('tipo', 'adelanto')
      .in('estado', ['calculado', 'aprobado', 'pagado'])
      .gte('fecha_desde', periodo.fecha_desde)
      .lte('fecha_hasta', periodo.fecha_hasta)

    if (adelantosPeriodos && adelantosPeriodos.length > 0) {
      const idsAdelanto = adelantosPeriodos.map((p) => p.id)
      const { data: detallesAdelanto } = await supabase
        .from('nomina_detalle')
        .select('id, empleado_id, total_remunerativo')
        .in('periodo_id', idsAdelanto)

      const cADELANTO_DED = conceptosMap['DESCUENTO_ADELANTO'] || conceptosMap['ADELANTO_QUINCENAL'] || await supabase.from('nomina_conceptos').select('id').match({ company_id: periodo.company_id, codigo: 'DESCUENTO_ADELANTO' }).maybeSingle().then((r) => r.data) || await supabase.from('nomina_conceptos').select('id').match({ company_id: periodo.company_id, codigo: 'ADELANTO_QUINCENAL' }).maybeSingle().then((r) => r.data)

      for (const da of detallesAdelanto || []) {
        const montoAdelanto = Number(da.total_remunerativo)
        if (montoAdelanto <= 0) continue

        const { data: detalleCierre } = await supabase
          .from('nomina_detalle')
          .select('id, total_deducciones, neto_pagar')
          .match({ periodo_id: periodoId, empleado_id: da.empleado_id })
          .maybeSingle()
        if (!detalleCierre) continue

        // Insertar línea de deducción del adelanto
        if (cADELANTO_DED) {
          await supabase.from('nomina_lineas').insert({
            company_id: periodo.company_id, nomina_detalle_id: detalleCierre.id,
            concepto_id: cADELANTO_DED.id, cantidad: 1,
            monto_unitario: -montoAdelanto, monto_total: -montoAdelanto,
            origen: 'adelanto',
          })
        }

        // Actualizar totales del detalle
        const newDed = Number(detalleCierre.total_deducciones) + montoAdelanto
        const newNeto = Number(detalleCierre.neto_pagar) - montoAdelanto
        await supabase.from('nomina_detalle').update({
          total_deducciones: redondear(newDed, 'PYG'),
          neto_pagar: redondear(newNeto, 'PYG'),
        }).eq('id', detalleCierre.id)
      }
    }
  }

  // Actualizar estado
  await supabase.from('nomina_periodos').update({ estado: 'calculado' }).eq('id', periodoId)
  return totalEmpleados
}

export async function aprobarPeriodo(id, userId) {
  const supabase = getSupabase()
  const { error } = await supabase.from('nomina_periodos').update({ estado: 'aprobado' }).eq('id', id)
  if (error) throw error
}

export async function pagarPeriodo(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('nomina_periodos').update({ estado: 'pagado' }).eq('id', id)
  if (error) throw error
  // Generar asiento de pago (descargo contra banco)
  const result = await generarAsientoPagoNomina(id)
  if (result?.error) throw new Error(result.error)
}

export async function obtenerDetallePeriodo(periodoId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('nomina_detalle').select('*, empleado:empleado_id(nombre, apellido)').eq('periodo_id', periodoId).order('empleado_id')
  if (error) throw error; return data || []
}

export async function obtenerLineasEmpleado(nominaDetalleId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('nomina_lineas').select('*').eq('nomina_detalle_id', nominaDetalleId)
  if (error) throw error
  // Resolver nombres de conceptos por separado (evita errores de join)
  const ids = [...new Set((data || []).map((l) => l.concepto_id).filter(Boolean))]
  if (ids.length > 0) {
    const { data: conc } = await supabase.from('nomina_conceptos').select('id, codigo, nombre, tipo, orden, es_imponible_irp').in('id', ids)
    const map = {}; (conc || []).forEach((c) => { map[c.id] = c })
    return (data || []).map((l) => ({ ...l, concepto: map[l.concepto_id] || null }))
      .sort((a, b) => (a.concepto?.orden || 999) - (b.concepto?.orden || 999))
  }
  return data || []
}

export async function recalcularEmpleado(periodoId, empleadoId, userId) {
  return calcularPeriodo(periodoId)
}

function nombreMes(m) {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return meses[m - 1]
}

export async function generarPeriodos(companyId, hastaFecha) {
  const supabase = getSupabase()
  const { data: config } = await supabase.from('nomina_config').select('*').eq('company_id', companyId).maybeSingle()
  const freq = config?.frecuencia || 'mensual'
  const diaCierre = config?.dia_cierre || 0
  const diaPago = config?.dia_pago || 5

  // Último período existente
  const { data: ultimos } = await supabase.from('nomina_periodos').select('fecha_hasta').eq('company_id', companyId).order('fecha_hasta', { ascending: false }).limit(1)
  let desde = ultimos?.[0]?.fecha_hasta ? new Date(ultimos[0].fecha_hasta + 'Z') : new Date()
  desde.setDate(desde.getDate() + 1)

  const hasta = new Date(hastaFecha + 'Z')
  const creados = []

  while (desde <= hasta) {
    let fechaHasta
    let nombre

    if (freq === 'semanal') {
      fechaHasta = new Date(desde)
      fechaHasta.setDate(fechaHasta.getDate() + 6)
      const nroSem = Math.ceil((desde - new Date(desde.getFullYear(), 0, 1)) / 604800000)
      nombre = `Semana ${nroSem}`
    } else if (freq === 'quincenal') {
      if (desde.getDate() <= 15) {
        fechaHasta = new Date(desde.getFullYear(), desde.getMonth(), 15)
        nombre = `1ra Q ${nombreMes(desde.getMonth() + 1)}`
        if (fechaHasta < desde) fechaHasta = new Date(desde.getFullYear(), desde.getMonth() + 1, 15)
      } else {
        fechaHasta = new Date(desde.getFullYear(), desde.getMonth() + 1, 0)
        nombre = `2da Q ${nombreMes(desde.getMonth() + 1)}`
      }
    } else {
      // mensual
      if (diaCierre > 0) {
        fechaHasta = new Date(desde.getFullYear(), desde.getMonth(), diaCierre)
        if (fechaHasta < desde) fechaHasta = new Date(desde.getFullYear(), desde.getMonth() + 1, diaCierre)
      } else {
        fechaHasta = new Date(desde.getFullYear(), desde.getMonth() + 1, 0)
      }
      nombre = `${nombreMes(desde.getMonth() + 1)} ${desde.getFullYear()}`
    }

    const fDesde = `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`
    const fHasta = `${fechaHasta.getFullYear()}-${String(fechaHasta.getMonth() + 1).padStart(2, '0')}-${String(fechaHasta.getDate()).padStart(2, '0')}`
    const fPago = `${fechaHasta.getFullYear()}-${String(fechaHasta.getMonth() + 1).padStart(2, '0')}-${String(Math.min(diaPago, 28)).padStart(2, '0')}`

    const { data, error } = await supabase.from('nomina_periodos').insert({
      company_id: companyId, nombre,
      fecha_desde: fDesde, fecha_hasta: fHasta, fecha_pago: fPago,
      frecuencia: freq, tipo: 'ordinario',
    }).select('id').single()
    if (!error) creados.push(data.id)

    desde = new Date(fechaHasta)
    desde.setDate(desde.getDate() + 1)
  }

  return creados
}
