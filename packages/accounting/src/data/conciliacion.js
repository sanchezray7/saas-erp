import { getSupabase } from '@saas/core'

export async function listarConciliaciones(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('conciliaciones')
    .select('*, account:account_id(code, name, banco_nombre, numero_cuenta)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function obtenerConciliacion(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('conciliaciones')
    .select('*, account:account_id(code, name, banco_nombre, numero_cuenta)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function crearConciliacion(companyId, payload) {
  const supabase = getSupabase()
  const { data: saldoLibro } = await supabase.rpc('calcular_saldo_libro', {
    p_account_id: payload.account_id,
    p_hasta: payload.periodo_fin,
  })
  const { data, error } = await supabase.from('conciliaciones').insert({
    company_id: companyId,
    account_id: payload.account_id,
    periodo_inicio: payload.periodo_inicio,
    periodo_fin: payload.periodo_fin,
    saldo_inicial_extracto: Number(payload.saldo_inicial) || 0,
    saldo_final_extracto: Number(payload.saldo_final) || 0,
    saldo_inicial_libro: Number(payload.saldo_inicial_libro) || 0,
    saldo_final_libro: Number(saldoLibro || 0),
    estado: 'abierta',
  }).select('id').single()
  if (error) throw error
  return data.id
}

export async function cerrarConciliacion(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('conciliaciones').update({ estado: 'cerrada' }).eq('id', id)
  if (error) throw error
}

// Extractos
export async function listarExtractos(conciliacionId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('extractos_bancarios')
    .select('*')
    .eq('conciliacion_id', conciliacionId)
    .order('fecha')
  if (error) throw error
  return data || []
}

export async function importarExtracto(companyId, accountId, conciliacionId, lineas) {
  const supabase = getSupabase()
  // Primero borrar extractos previos de esta conciliación (para re-importar)
  await supabase.from('extractos_bancarios').delete().eq('conciliacion_id', conciliacionId)

  const rows = lineas.map((l) => ({
    company_id: companyId,
    account_id: accountId,
    conciliacion_id: conciliacionId,
    fecha: l.fecha,
    concepto: l.concepto,
    monto: Number(l.monto),
    referencia: l.referencia || null,
  }))
  const { error } = await supabase.from('extractos_bancarios').insert(rows)
  if (error) throw error
}

export async function toggleConciliarExtracto(extractoId, conciliado) {
  const supabase = getSupabase()
  const { error } = await supabase.from('extractos_bancarios').update({ conciliado }).eq('id', extractoId)
  if (error) throw error
}

// Transacciones del libro
export async function obtenerTransaccionLibro(accountId, desde, hasta) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('obtener_transacciones_libro', {
    p_account_id: accountId,
    p_desde: desde,
    p_hasta: hasta,
  })
  if (error) throw error
  return data || []
}
