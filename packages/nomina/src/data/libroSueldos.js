import { getSupabase } from '@saas/core'

export async function obtenerLibroSueldos(periodoId, companyId) {
  const supabase = getSupabase()

  const [periodoRes, configRes] = await Promise.all([
    supabase.from('nomina_periodos').select('*').eq('id', periodoId).single(),
    supabase.from('nomina_config').select('numero_patronal').eq('company_id', companyId).maybeSingle(),
  ])
  const periodo = periodoRes.data
  const numeroPatronal = configRes.data?.numero_patronal || ''
  if (!periodo) return { periodo: null, filas: [], numeroPatronal: '' }

  const { data: detalles } = await supabase
    .from('nomina_detalle')
    .select('*, empleado:empleado_id(id, nombre, apellido)')
    .eq('periodo_id', periodoId)

  if (!detalles || detalles.length === 0) return { periodo, filas: [] }

  const empIds = detalles.map((d) => d.empleado_id)
  const [documentosRes, fiscalRes, contratosRes] = await Promise.all([
    supabase.from('empleado_documentos').select('empleado_id, numero').eq('tipo', 'CI').in('empleado_id', empIds),
    supabase.from('empleado_fiscal').select('empleado_id, numero_ips').in('empleado_id', empIds),
    supabase.from('empleado_contratos').select('empleado_id, cargo, fecha_ingreso').in('empleado_id', empIds).is('vigencia_hasta', null),
  ])

  const docsMap = {}
  ;(documentosRes.data || []).forEach((d) => { docsMap[d.empleado_id] = d.numero })
  const fiscalMap = {}
  ;(fiscalRes.data || []).forEach((f) => { fiscalMap[f.empleado_id] = f.numero_ips })
  const contratoMap = {}
  ;(contratosRes.data || []).forEach((c) => { contratoMap[c.empleado_id] = c })

  // Cargar líneas para todos los detalles
  const detIds = detalles.map((d) => d.id)
  const { data: lines } = await supabase
    .from('nomina_lineas')
    .select('monto_total, nomina_detalle_id, concepto:concepto_id(codigo, tipo)')
    .in('nomina_detalle_id', detIds)

  const lineasPorDet = {}
  for (const l of lines || []) {
    if (!lineasPorDet[l.nomina_detalle_id]) lineasPorDet[l.nomina_detalle_id] = []
    lineasPorDet[l.nomina_detalle_id].push(l)
  }

  const filas = []
  for (const d of detalles) {
    const ls = lineasPorDet[d.id] || []
    const emp = d.empleado

    // Extraer montos por concepto
    const montoPorConcepto = {}
    for (const l of ls) {
      const cod = l.concepto?.codigo
      if (cod) montoPorConcepto[cod] = (montoPorConcepto[cod] || 0) + Number(l.monto_total)
    }

    // HE total (suma de HE50 + HE100 + HE130)
    const heTotal = (montoPorConcepto['HE50'] || 0) + (montoPorConcepto['HE100'] || 0) + (montoPorConcepto['HE130'] || 0)
    const vacMonto = montoPorConcepto['VACACIONES'] || 0
    const aguinaldoMonto = montoPorConcepto['AGUINALDO'] || 0
    const ipsMonto = Math.abs(montoPorConcepto['IPS'] || 0)
    const otrasDed = Math.abs(d.total_deducciones) - ipsMonto
    const baseIPS = montoPorConcepto['BASE_IPS'] || 0

    const contrato = contratoMap[d.empleado_id]
    const fechaIngreso = contrato?.fecha_ingreso || ''

    filas.push({
      empleado_id: d.empleado_id,
      nombre: `${emp?.apellido || ''}, ${emp?.nombre || ''}`,
      apellido: emp?.apellido || '',
      nombre_solo: emp?.nombre || '',
      ci: docsMap[d.empleado_id] || '',
      numero_ips: fiscalMap[d.empleado_id] || '',
      cargo: contrato?.cargo || '',
      fecha_ingreso: fechaIngreso?.slice(0, 10) || '',
      dias: d.dias_trabajados || 0,
      salario: Number(d.salario_base) || 0,
      remunerativo: Number(d.total_remunerativo) || 0,
      base_ips: Math.abs(Number(baseIPS)),
      he: heTotal,
      vacaciones: vacMonto,
      aguinaldo: aguinaldoMonto,
      ips: ipsMonto,
      otras_deducciones: Math.max(0, otrasDed),
      neto: Number(d.neto_pagar) || 0,
    })
  }

  return { periodo, filas, numeroPatronal }
}
