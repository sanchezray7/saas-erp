import { getSupabase } from '@saas/core'

export async function listarCobrosCliente(facturaId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('cobros_cliente')
    .select('*, medio_pago:medio_pago_id(nombre), cuenta_banco:cuenta_banco_id(code, name)')
    .eq('factura_id', facturaId)
    .order('fecha_cobro', { ascending: false })
  if (error) throw error
  return data || []
}

export async function registrarCobroCliente(companyId, userId, payload) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('cobros_cliente').insert({
    company_id: companyId, factura_id: payload.factura_id,
    medio_pago_id: payload.medio_pago_id || null,
    cuenta_banco_id: payload.cuenta_banco_id || null,
    monto: payload.monto, fecha_cobro: payload.fecha_cobro || new Date().toISOString().slice(0, 10),
    referencia: payload.referencia || null, notas: payload.notas || null,
    created_by: userId,
  }).select('id').single()
  if (error) throw error

  // Actualizar saldo pendiente
  const { data: cobros } = await supabase.from('cobros_cliente').select('monto').eq('factura_id', payload.factura_id)
  const { data: factura } = await supabase.from('facturas').select('total').eq('id', payload.factura_id).single()
  const totalCobrado = (cobros || []).reduce((s, c) => s + Number(c.monto), 0)
  const saldo = Number(factura.total) - totalCobrado
  await supabase.from('facturas').update({ saldo_pendiente: Math.max(0, saldo) }).eq('id', payload.factura_id)

  if (saldo <= 0) {
    await supabase.from('facturas').update({ estado: 'cobrada' }).eq('id', payload.factura_id)
  }

  return data.id
}

export async function eliminarCobroCliente(cobroId, facturaId) {
  const supabase = getSupabase()
  const { error } = await supabase.from('cobros_cliente').delete().eq('id', cobroId)
  if (error) throw error

  const { data: cobros } = await supabase.from('cobros_cliente').select('monto').eq('factura_id', facturaId)
  const { data: factura } = await supabase.from('facturas').select('total').eq('id', facturaId).single()
  const totalCobrado = (cobros || []).reduce((s, c) => s + Number(c.monto), 0)
  await supabase.from('facturas').update({
    saldo_pendiente: Number(factura.total) - totalCobrado,
    estado: 'aprobada',
  }).eq('id', facturaId)
}
