import { getSupabase } from '@saas/core'

export async function listarConceptos(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('nomina_conceptos').select('*').eq('company_id', companyId).order('orden').order('nombre')
  if (error) throw error; return data || []
}

export async function guardarConcepto(companyId, payload) {
  const supabase = getSupabase()
  const ordenCalculo = payload.orden_calculo !== undefined && payload.orden_calculo !== '' ? Number(payload.orden_calculo) : 0
  if (payload.id) {
    const { error } = await supabase.from('nomina_conceptos').update({
      codigo: payload.codigo, nombre: payload.nombre, tipo: payload.tipo,
      formula: payload.formula || null, porcentaje: payload.porcentaje || null,
      orden: Number(payload.orden) || 0, orden_calculo: ordenCalculo,
      activo: payload.activo !== false,
      es_imponible_ips: payload.es_imponible_ips === true,
      es_imponible_irp: payload.es_imponible_irp === true,
      account_id: payload.account_id || null,
    }).eq('id', payload.id)
    if (error) throw error; return payload.id
  }
  // Buscar si ya existe (unique company_id, codigo)
  const { data: existente } = await supabase.from('nomina_conceptos').select('id').match({ company_id: companyId, codigo: payload.codigo }).maybeSingle()
  if (existente) {
    const { error } = await supabase.from('nomina_conceptos').update({
      nombre: payload.nombre, tipo: payload.tipo, formula: payload.formula || null,
      porcentaje: payload.porcentaje || null, orden: Number(payload.orden) || 0, orden_calculo: ordenCalculo,
      es_imponible_ips: payload.es_imponible_ips === true,
      es_imponible_irp: payload.es_imponible_irp === true,
      account_id: payload.account_id || null,
    }).eq('id', existente.id)
    if (error) throw error; return existente.id
  }
  const { data, error } = await supabase.from('nomina_conceptos').insert({
    company_id: companyId, codigo: payload.codigo, nombre: payload.nombre,
    tipo: payload.tipo, formula: payload.formula || null,
    porcentaje: payload.porcentaje || null, orden: Number(payload.orden) || 0, orden_calculo: ordenCalculo,
    es_imponible_ips: payload.es_imponible_ips === true,
    es_imponible_irp: payload.es_imponible_irp === true,
    account_id: payload.account_id || null,
  }).select('id').single()
  if (error) throw error; return data.id
}

export async function eliminarConcepto(id) {
  const supabase = getSupabase(); const { error } = await supabase.from('nomina_conceptos').delete().eq('id', id); if (error) throw error
}

export const conceptosSeedPY = [
  { codigo: 'SALARIO', nombre: 'Salario base', tipo: 'remunerativo', formula: 'diario * dias_salario', orden: 1, orden_calculo: 1, es_imponible_ips: true, es_imponible_irp: true },
  { codigo: 'HE50', nombre: 'Hora extra 50%', tipo: 'remunerativo', formula: 'he50_min / 60 * valor_hora * 1.5', orden: 2, orden_calculo: 2, es_imponible_ips: true, es_imponible_irp: true },
  { codigo: 'HE100', nombre: 'Hora extra 100%', tipo: 'remunerativo', formula: 'he100_min / 60 * valor_hora * 2', orden: 3, orden_calculo: 3, es_imponible_ips: true, es_imponible_irp: true },
  { codigo: 'HE130', nombre: 'Hora extra 130%', tipo: 'remunerativo', formula: 'he130_min / 60 * valor_hora * 2.3', orden: 4, orden_calculo: 4, es_imponible_ips: true, es_imponible_irp: true },
  { codigo: 'NOCTURNIDAD', nombre: 'Nocturnidad', tipo: 'remunerativo', formula: 'noct_min / 60 * valor_hora * 0.3', orden: 5, orden_calculo: 5, es_imponible_ips: true, es_imponible_irp: true },
  { codigo: 'VACACIONES', nombre: 'Vacaciones pagadas', tipo: 'remunerativo', formula: 'diario * dias_vacaciones', orden: 8, orden_calculo: 6, es_imponible_ips: true, es_imponible_irp: true },
  { codigo: 'AGUINALDO', nombre: 'Aguinaldo', tipo: 'remunerativo', orden: 9, orden_calculo: 7, es_imponible_ips: false, es_imponible_irp: false },
  { codigo: 'AUSENCIA', nombre: 'Inasistencia', tipo: 'deduccion', formula: 'dias_ausencia * diario', orden: 10, orden_calculo: 10 },
  { codigo: 'BASE_IPS', nombre: 'Base imponible IPS', tipo: 'no_remunerativo', orden: 6, orden_calculo: 20 },
  { codigo: 'BASE_IRP', nombre: 'Base imponible IRP', tipo: 'no_remunerativo', orden: 7, orden_calculo: 21 },
  { codigo: 'IPS', nombre: 'IPS Aporte', tipo: 'deduccion', formula: 'BASE_IPS * 0.09', porcentaje: 9, orden: 20, orden_calculo: 30 },
  { codigo: 'IPS_PATRONAL', nombre: 'IPS Patronal', tipo: 'aporte_patronal', formula: 'BASE_IPS * 0.165', porcentaje: 16.5, orden: 30, orden_calculo: 31 },
  { codigo: 'ADELANTO_QUINCENAL', nombre: 'Adelanto quincenal', tipo: 'deduccion', orden: 11, orden_calculo: 40, porcentaje: 50 },
  { codigo: 'ADELANTO_PAGADO', nombre: 'Adelanto pagado', tipo: 'remunerativo', orden: 13, orden_calculo: 41 },
  { codigo: 'DESCUENTO_ADELANTO', nombre: 'Descuento adelanto', tipo: 'deduccion', orden: 12, orden_calculo: 42 },
  { codigo: 'PRORRATEO_AGUINALDO', nombre: 'Prorrateo aguinaldo', tipo: 'no_remunerativo', formula: 'BASE_IPS / 12', orden: 10, orden_calculo: 50 },
]
