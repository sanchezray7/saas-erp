import { getSupabase } from '@saas/core'

export async function listarMediosPago(companyId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('medios_pago').select('*').eq('company_id', companyId).eq('activo', true).order('nombre')
  if (error) throw error
  return data || []
}

export async function guardarMedioPago(companyId, { nombre }) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('medios_pago').insert({ company_id: companyId, nombre }).select('id').single()
  if (error) throw error
  return data.id
}

export async function eliminarMedioPago(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('medios_pago').delete().eq('id', id)
  if (error) throw error
}

export async function listarPagosProveedor(facturaId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('pagos_proveedor')
    .select('*, medio_pago:medio_pago_id(nombre), cuenta_banco:cuenta_banco_id(code, name)')
    .eq('factura_id', facturaId)
    .order('fecha_pago', { ascending: false })
  if (error) throw error
  return data || []
}

export async function registrarPagoProveedor(companyId, userId, payload) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('pagos_proveedor').insert({
    company_id: companyId, factura_id: payload.factura_id,
    medio_pago_id: payload.medio_pago_id || null,
    cuenta_banco_id: payload.cuenta_banco_id || null,
    monto: payload.monto, fecha_pago: payload.fecha_pago || new Date().toISOString().slice(0, 10),
    referencia: payload.referencia || null, notas: payload.notas || null,
    created_by: userId,
  }).select('id').single()
  if (error) throw error

  // Actualizar saldo pendiente
  const { data: pagos } = await supabase.from('pagos_proveedor').select('monto').eq('factura_id', payload.factura_id)
  const { data: factura } = await supabase.from('proveedor_facturas').select('total').eq('id', payload.factura_id).single()
  const totalPagado = (pagos || []).reduce((s, p) => s + Number(p.monto), 0)
  const saldo = Number(factura.total) - totalPagado
  await supabase.from('proveedor_facturas').update({ saldo_pendiente: Math.max(0, saldo) }).eq('id', payload.factura_id)

  // Si saldo = 0, marcar como pagada
  if (saldo <= 0) {
    await supabase.from('proveedor_facturas').update({ estado: 'pagada' }).eq('id', payload.factura_id)
  }

  return data.id
}

export async function eliminarPagoProveedor(pagoId, facturaId) {
  const supabase = getSupabase()
  const { error } = await supabase.from('pagos_proveedor').delete().eq('id', pagoId)
  if (error) throw error

  // Recalcular saldo
  const { data: pagos } = await supabase.from('pagos_proveedor').select('monto').eq('factura_id', facturaId)
  const { data: factura } = await supabase.from('proveedor_facturas').select('total').eq('id', facturaId).single()
  const totalPagado = (pagos || []).reduce((s, p) => s + Number(p.monto), 0)
  await supabase.from('proveedor_facturas').update({
    saldo_pendiente: Number(factura.total) - totalPagado,
    estado: 'conciliada',
  }).eq('id', facturaId)
}
